import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.e2e.*", "**/e2e/**"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test-helpers/**",
        "**/types/**",
        "**/__mocks__/**",
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"],
    alias: {
      // Map core imports to the core source file since index.ts doesn't exist
      "../../../../../core/index.js": new URL("../../core/core.ts", import.meta.url).pathname,
      "core/index.js": new URL("../../core/core.ts", import.meta.url).pathname,
    },
  },
});
