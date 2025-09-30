/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom only if your editor unit tests touch DOM APIs. Otherwise "node" is faster.
    environment: "node",
    include: ["tests/**/*.{spec,test}.{ts,js}"],
    // Helpful if you import from /src with absolute paths
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    coverage: { reporter: ["text", "html"] },
  },
});
