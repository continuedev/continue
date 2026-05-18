#!/usr/bin/env node

import * as esbuild from "esbuild";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Parse command line arguments
const args = process.argv.slice(2);
const noMinify = args.includes("--no-minify");

const __dirname = dirname(fileURLToPath(import.meta.url));

// List of packages to mark as external (ONLY native modules that cannot be bundled)
// Note: Everything else will be bundled to create a self-contained CLI
// Users should not need to install any additional dependencies
const external = [
  "@sentry/profiling-node", // Contains native profiler bindings (optional)
  "fsevents", // macOS native file watcher (optional dependency)
  "./xhr-sync-worker.js", // JSDOM worker file that needs to be copied separately
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
    minify: !noMinify, // Use --no-minify flag to control minification
    metafile: true,
    plugins: [optionalDevtoolsPlugin],

    // Handle .js extensions in imports
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],

    // Handle TypeScript paths and local packages
    alias: {
      "@yutoagentic/config-yaml": resolve(
        __dirname,
        "../../packages/config-yaml/dist/index.js",
      ),
      "@yutoagentic/openai-adapters": resolve(
        __dirname,
        "../../packages/openai-adapters/dist/index.js",
      ),
      "@yutoagentic/config-types": resolve(
        __dirname,
        "../../packages/config-types/dist/index.js",
      ),
      "@yutoagentic/sdk": resolve(
        __dirname,
        "../../packages/yutoagentic-sdk/typescript",
      ),
      core: resolve(__dirname, "../../core"),
      "@yutoagentic/fetch": resolve(
        __dirname,
        "../../packages/fetch/dist/index.js",
      ),
      "@yutoagentic/llm-info": resolve(
        __dirname,
        "../../packages/llm-info/dist/index.js",
      ),
      "@yutoagentic/terminal-security": resolve(
        __dirname,
        "../../packages/terminal-security/dist/index.js",
      ),
    },

    // Add banner to create require for CommonJS packages
    banner: {
      js: `import { createRequire as __createRequire } from 'module';
    import { fileURLToPath as __fileURLToPath } from 'url';
    import { dirname as __pathDirname } from 'path';
    const require = __createRequire(import.meta.url);
    const __filename = __fileURLToPath(import.meta.url);
    const __dirname = __pathDirname(__filename);`,
    },
  });

  // Write metafile for analysis
  writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));

  // Create wrapper script with shebang that explicitly runs the CLI
  // Note: We must call runCli(); a plain dynamic import will not execute the CLI.
  writeFileSync(
    "dist/yt.js",
    "#!/usr/bin/env node\nimport { runCli } from './index.js';\nawait runCli();\n",
  );
  // Copy worker files needed by JSDOM
  const workerSource = resolve(
    __dirname,
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
  );
  const workerDest = resolve(__dirname, "dist/xhr-sync-worker.js");
  try {
    copyFileSync(workerSource, workerDest);
    console.log("✓ Copied xhr-sync-worker.js");
  } catch (error) {
    console.warn("Warning: Could not copy xhr-sync-worker.js:", error.message);
  }

  // Ensure sqlite native binding is where bundled bindings lookup expects it.
  const sqliteBinaryCandidates = [
    resolve(__dirname, "node_modules/sqlite3/build/Release/node_sqlite3.node"),
    resolve(
      __dirname,
      "../../core/node_modules/sqlite3/build/Release/node_sqlite3.node",
    ),
    resolve(
      __dirname,
      "../../binary/bin/win32-x64/build/Release/node_sqlite3.node",
    ),
  ];
  const sqliteBinarySource = sqliteBinaryCandidates.find((candidate) =>
    existsSync(candidate),
  );
  if (sqliteBinarySource) {
    const sqliteBuildDir = resolve(__dirname, "build/Release");
    const sqliteBuildBinary = resolve(sqliteBuildDir, "node_sqlite3.node");
    const sqliteRootBinary = resolve(__dirname, "build/node_sqlite3.node");

    const copySqliteBinary = (destination) => {
      try {
        copyFileSync(sqliteBinarySource, destination);
        return true;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          ["EBUSY", "EPERM", "EACCES"].includes(error.code)
        ) {
          if (existsSync(destination)) {
            console.warn(
              `Warning: Could not refresh ${destination} (${error.code}); using existing file.`,
            );
            return true;
          }
          console.warn(
            `Warning: Could not copy sqlite binary to ${destination} (${error.code}).`,
          );
          return false;
        }
        throw error;
      }
    };

    mkdirSync(sqliteBuildDir, { recursive: true });
    const copiedBuildBinary = copySqliteBinary(sqliteBuildBinary);
    const copiedRootBinary = copySqliteBinary(sqliteRootBinary);
    if (copiedBuildBinary || copiedRootBinary) {
      console.log("✓ Prepared node_sqlite3.node");
    }
  } else {
    console.warn(
      "Warning: Could not find node_sqlite3.node in known locations. CLI may fail at runtime.",
    );
  }

  // Make the wrapper script executable
  chmodSync("dist/yt.js", 0o755);

  // Calculate bundle size
  const bundleSize = result.metafile.outputs["dist/index.js"].bytes;
  console.log(
    `✓ Build complete! Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`,
  );
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
