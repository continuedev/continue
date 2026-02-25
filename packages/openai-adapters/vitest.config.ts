import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10000,
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.vitest.{ts,tsx}"],
    exclude: ["src/**/*.live.test.{ts,tsx}", "node_modules"],
  },
  resolve: {
    alias: {
      "(.+)\\.js": "$1",
    },
  },
});
