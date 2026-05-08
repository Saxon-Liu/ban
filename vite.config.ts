import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import electron from "vite-plugin-electron/simple";

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
    plugins: [vue(), ...electronPlugins],
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
            "vendor-excel": ["exceljs", "xlsx"],
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
