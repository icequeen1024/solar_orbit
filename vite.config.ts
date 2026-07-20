import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "/solar_orbit/",
  plugins: [react()],
  build: {
    target: "es2022",
    rollupOptions: {
      input: resolve(import.meta.dirname, "dev.html"),
    },
  },
});
