#!/usr/bin/env node

import * as esbuild from "esbuild";
import { chmodSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// List of packages to mark as external (ONLY native modules that cannot be bundled)
// Note: Everything else will be bundled to create a self-contained CLI
// Users should not need to install any additional dependencies
const external = [
  "@sentry/profiling-node", // Contains native profiler bindings (optional)
  "fsevents", // macOS native file watcher (optional dependency)
];

console.log("Building CLI with esbuild...");

// Plugin to handle optional react-devtools-core
const optionalDevtoolsPlugin = {
  name: "optional-devtools",
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => {
      // Return path to our stub instead of marking as external
      return { path: resolve(__dirname, "stubs/react-devtools-core.js") };
    });
  },
};

try {
  const result = await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    outfile: "dist/index.js",
    external,
    sourcemap: true,
    minify: true, // Minify for smaller bundle size
    metafile: true,
    plugins: [optionalDevtoolsPlugin],

    // Handle .js extensions in imports
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],

    // Handle TypeScript paths and local packages
    alias: {
      "@continuedev/config-yaml": resolve(
        __dirname,
        "../../packages/config-yaml/dist/index.js",
      ),
      "@continuedev/openai-adapters": resolve(
        __dirname,
        "../../packages/openai-adapters/dist/index.js",
      ),
      "@continuedev/config-types": resolve(
        __dirname,
        "../../packages/config-types/dist/index.js",
      ),
      core: resolve(__dirname, "../../core"),
      "@continuedev/fetch": resolve(
        __dirname,
        "../../packages/fetch/dist/index.js",
      ),
      "@continuedev/llm-info": resolve(
        __dirname,
        "../../packages/llm-info/dist/index.js",
      ),
    },

    // Add banner to create require for CommonJS packages
    banner: {
      js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`,
    },
  });

  // Write metafile for analysis
  writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));

  // Create wrapper script with shebang
  writeFileSync("dist/cn.js", "#!/usr/bin/env node\nimport('./index.js');");

  // Make the wrapper script executable
  chmodSync("dist/cn.js", 0o755);

  // Calculate bundle size
  const bundleSize = result.metafile.outputs["dist/index.js"].bytes;
  console.log(
    `✓ Build complete! Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`,
  );
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
