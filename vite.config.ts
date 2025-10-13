import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  preview: {
    // For preview mode (after build)
    host: true,
    port: 4173
  },
  build: {
    // Ensure proper build output
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
