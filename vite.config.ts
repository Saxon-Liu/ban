import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [vue()],
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
});
