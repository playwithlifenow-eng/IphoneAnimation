import { INSTRUMENT_VERSION } from "./src/capabilities";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sourceIdentity } from "./build-identity";
import { middleware } from "./server";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "studio-local-store",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "implementation.json",
          source: JSON.stringify({
            schemaVersion: 1,
            sourceHash: sourceIdentity(),
            builtAt: new Date().toISOString(),
            implementation: INSTRUMENT_VERSION,
          }),
        });
      },
      configureServer(s) {
        s.middlewares.use((req, res, next) => void middleware(req, res, next));
      },
      configurePreviewServer(s) {
        s.middlewares.use((req, res, next) => void middleware(req, res, next));
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    manifest: true,
    rollupOptions: { input: { studio: "index.html", runtime: "runtime.html", visualRuntime: "visual-runtime.html" } },
  },
});
