import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Backend (cmd/api) defaults to :8080.
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
