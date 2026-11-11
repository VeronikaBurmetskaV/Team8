import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One origin for the browser: Vite serves the SPA and proxies /api to Spring (ADR-0010).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
