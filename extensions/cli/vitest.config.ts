import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
<<<<<<< HEAD
    setupFiles: ["./vitest.setup.ts"],
=======
    setupFiles: ["./vitest.global-dir-setup.ts", "./vitest.setup.ts"],
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
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
    alias: {
      src: path.resolve(__dirname, "src"),
    },
    extensions: [".js", ".ts", ".tsx", ".json"],
  },
});
