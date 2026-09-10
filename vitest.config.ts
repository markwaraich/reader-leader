import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": templateRoot,
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/gemini*.test.ts",
      "server/speech-align-route.test.ts",
      "server/read-aloud-vad.test.ts",
      "server/alignment-engine.test.ts",
      "server/accent-invariance.test.ts",
      "server/telemetry-store.test.ts",
      "server/reading-scoring.test.ts",
      "server/session-storage.test.ts",
      "server/use-speech-recognition.test.tsx",
    ],
  },
});
