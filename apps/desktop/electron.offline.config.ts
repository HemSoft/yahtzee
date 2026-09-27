import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "out/offline/main",
      rollupOptions: { input: resolve("src/main/offline.ts"), output: { format: "cjs", entryFileNames: "index.cjs" } },
    },
  },
  renderer: {
    plugins: [react()],
    envPrefix: "YAHTZEE_PUBLIC_",
    build: { outDir: "out/offline/renderer", rollupOptions: { input: resolve("src/renderer/offline.html") } },
  },
});
