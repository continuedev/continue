import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTransformMode: {
      web: ["/.[jt]s?$/"],
      ssr: ["/.[jt]s?$/"],
    },
    globalSetup: "./test/vitest.global-setup.ts",
    setupFiles: "./test/vitest.setup.ts",
    fileParallelism: false,
    include: ["**/*.vitest.ts"],
  },
});
