import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // No setupFiles — vitest.setup.ts mocks global.fetch which breaks real API calls
    include: ["src/smoke-api/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    retry: 2,
    // Run sequentially to avoid rate-limiting from real API calls
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, "src"),
    },
    extensions: [".js", ".ts", ".tsx", ".json"],
  },
});
