import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import electron from "vite-plugin-electron/simple";

function buildRendererCsp(mode: string, options: { includeFrameAncestors?: boolean } = {}) {
  const { includeFrameAncestors = true } = options;
  const isDevelopment = mode === "development" || mode === "electron";
  const scriptSources = ["'self'"];
  const connectSources = ["'self'"];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push(
      "http://127.0.0.1:2510",
      "http://localhost:2510",
      "ws://127.0.0.1:2510",
      "ws://localhost:2510"
    );
  }

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  if (includeFrameAncestors) {
    directives.push("frame-ancestors 'none'");
  }

  return directives.join("; ");
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const isElectronMode = mode === "electron";
  const electronPlugins = isElectronMode
    ? await electron({
      main: {
        entry: "electron/main.ts",
        async onstart({ startup }) {
          delete process.env.ELECTRON_RUN_AS_NODE;
          await startup([".", "--no-sandbox"]);
        },
        vite: {
          build: {
            outDir: "dist-electron",
              emptyOutDir: true,
            },
          },
        },
        preload: {
          input: "electron/preload.ts",
          vite: {
            build: {
              outDir: "dist-electron",
            },
          },
        },
      })
    : [];

  return {
    base: "./",
    appType: "spa",
    plugins: [
      vue(),
      {
        name: "inject-csp-meta",
        transformIndexHtml(html) {
          return html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
            `<meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${buildRendererCsp(mode, { includeFrameAncestors: false })}" />`
          );
        },
      },
      ...electronPlugins,
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-vue": ["vue", "vue-router"],
            "vendor-element-plus": ["element-plus", "@element-plus/icons-vue"],
            "vendor-excel": ["exceljs"],
            "vendor-utils": ["lodash-es", "dayjs"],
          },
        },
      },
    },
    server: {
      port: 2510,
      host: "0.0.0.0",
      // open: true,
    },
  };
});
