import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTransformMode: {
      web: ["/.[jt]s?$/"],
      ssr: ["/.[jt]s?$/"],
    },
    globalSetup: "./test/vitest.global-setup.ts",
    setupFiles: "./test/vitest.setup.ts",
    // include: ["**/*.test.ts"],
    fileParallelism: false,
    include: [
      "config/yaml/LocalPlatformClient.test.ts",
      "autocomplete/**/*.test.ts",
    ],
  },
});
