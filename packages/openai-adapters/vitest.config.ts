import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10000,
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.vitest.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "src/**/*.live.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "(.+)\\.js": "$1",
    },
  },
});
