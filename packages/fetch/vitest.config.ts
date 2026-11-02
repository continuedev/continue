import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // vitest >= 4 only excludes node_modules and .git by default; keep vitest 3's list
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
    ],
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
