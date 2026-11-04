import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // svg-builder 3's ESM build uses a directory import ("./content") that
      // Node's ESM loader rejects; its CommonJS build is fine. The esbuild
      // bundle resolves either, so only tests need pointing at the CJS entry.
      "svg-builder": path.resolve(
        __dirname,
        "node_modules/svg-builder/dist/cjs/index.cjs",
      ),
    },
  },
  test: {
    // vitest >= 4 only excludes node_modules and .git by default; keep vitest 3's list
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
    ],
    include: ["**/*.vitest.ts"],
    environment: "node",
  },
});
