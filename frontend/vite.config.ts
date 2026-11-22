import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// En desarrollo el navegador usa Vite (5173) y el gateway está en el puerto 80.
// En producción la SPA se sirve por el propio gateway, así que las URLs relativas
// (`/api/v1`, `/n8n`, `/uploads`) llegan siempre al nginx de entrada.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:80",
      "/n8n": "http://localhost:80",
      "/uploads": "http://localhost:80",
    },
  },
  test: {
    environment: "node",
  },
});
