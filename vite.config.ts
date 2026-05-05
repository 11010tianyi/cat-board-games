import { defineConfig } from "vite";

export default defineConfig({
  base: "/cat-board-games/",
  server: {
    port: 5173,
    strictPort: false,
  },
});
