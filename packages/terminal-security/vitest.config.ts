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
    globals: true,
    environment: "node",
  },
});
