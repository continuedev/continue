import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    timeout: 10000,
    globals: true,
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
  resolve: {
    alias: {
      // Handle .js imports for TypeScript files
      "./getAgentOptions.js": "./getAgentOptions.ts",
      "./stream.js": "./stream.ts",
      "./util.js": "./util.ts",
      "./certs.js": "./certs.ts",
      "./fetch.js": "./fetch.ts",
    },
  },
});
