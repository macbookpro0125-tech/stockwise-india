import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The build's date, so a problem report says which version it's about (help.js)
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
