import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Replaces react-scripts 5.0.1, which no longer completes a build on Node 22
// — `npm run build` sat at idle indefinitely rather than failing.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // The dev server proxies the API to the Express process so the frontend
    // calls the same relative paths in development and production, and the
    // session cookie is treated as same-origin.
    proxy: {
      "/api": { target: "http://localhost:5050", changeOrigin: true },
      "/clock-in": { target: "http://localhost:5050", changeOrigin: true },
      "/clock-out": { target: "http://localhost:5050", changeOrigin: true },
    },
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
});
