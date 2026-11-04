import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10000,
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
