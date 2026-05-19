import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 4301,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4300",
      "/reports": "http://localhost:4300",
      "/screenshots": "http://localhost:4300",
      "/traces": "http://localhost:4300"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
            return "vendor-react";
          }

          if (/[\\/]node_modules[\\/]monaco-editor[\\/]/.test(id)) {
            return "vendor-monaco";
          }

          if (/[\\/]node_modules[\\/](axios|dayjs|zustand|clsx|tailwind-merge)[\\/]/.test(id)) {
            return "vendor-utils";
          }

          return undefined;
        }
      }
    }
  }
});
