import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, "../..");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    envDir: monorepoRoot,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    envDir: monorepoRoot,
  },
  renderer: {
    plugins: [react()],
    envDir: monorepoRoot,
  },
});
