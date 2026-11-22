import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost", changeOrigin: true },
      "/uploads": { target: "http://localhost", changeOrigin: true },
      "/n8n": { target: "http://localhost", changeOrigin: true, ws: true },
    },
  },
});
