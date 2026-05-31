import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isTauri = process.env.TAURI_PLATFORM !== undefined || process.env.TAURI_BUILD === "1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Build-time pick between web and desktop platform impls.
      "@/lib/platform": path.resolve(
        __dirname,
        isTauri ? "src/lib/platform/desktop.ts" : "src/lib/platform/index.ts",
      ),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Tauri builds want a pre-evaluable single-page bundle.
    target: "esnext",
  },
});
