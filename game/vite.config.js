import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    watch: { usePolling: true, interval: 200 },
  },
});
