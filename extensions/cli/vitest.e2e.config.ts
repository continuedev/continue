import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/e2e/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: process.env.CI && process.platform === "darwin" ? 2 : 0,
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"],
  },
});
