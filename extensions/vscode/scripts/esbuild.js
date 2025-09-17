const fs = require("fs");

const { writeBuildTimestamp } = require("./utils");

const esbuild = require("esbuild");

const flags = process.argv.slice(2);

// Tiny plugin: turn any 'onnxruntime-web' (and subpaths) import into an empty module.
function nullOrtWeb() {
  return {
    name: "null-ort-web",
    setup(build) {
      build.onResolve({ filter: /^onnxruntime-web(?:\/.*)?$/ }, (args) => ({
        path: args.path,
        namespace: "null-ort",
      }));
      build.onLoad({ filter: /.*/, namespace: "null-ort" }, () => ({
        // Provide a default export so code like `ONNX_WEB.default ?? ONNX_WEB`
        // doesn't warn. We intentionally *don't* implement any APIs.
        contents: "export default {};",
        loader: "js",
      }));
    },
  };
}

const esbuildConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "esbuild", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  // Prefer Node resolution paths; do NOT include "browser" here
  conditions: ["node", "default"],
  mainFields: ["module", "main"],
  sourcemap: flags.includes("--sourcemap"),
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: {
    "import.meta.url": "importMetaUrl",
    // Guard any browser-path checks to keep Node backend selected
    "process.browser": "false",
    window: "undefined",
  },
  supported: { "dynamic-import": false },
  metafile: true,
  plugins: [
    // Belt-and-suspenders: make web backend impossible to pull in
    nullOrtWeb(),
    {
      name: "on-end-plugin",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error("Build failed with errors:", result.errors);
            throw new Error(result.errors);
          } else {
            try {
              fs.writeFileSync(
                "./build/meta.json",
                JSON.stringify(result.metafile, null, 2),
              );
            } catch (e) {
              console.error("Failed to write esbuild meta file", e);
            }
            console.log("VS Code Extension esbuild complete"); // used verbatim in vscode tasks to detect completion
          }
        });
      },
    },
  ],
};

void (async () => {
  // Create .buildTimestamp.js before starting the first build
  writeBuildTimestamp();
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
  } else if (flags.includes("--notify")) {
    const inFile = esbuildConfig.entryPoints[0];
    const outFile = esbuildConfig.outfile;

    // The watcher automatically notices changes to source files
    // so the only thing it needs to be notified about is if the
    // output file gets removed.
    if (fs.existsSync(outFile)) {
      console.log("VS Code Extension esbuild up to date");
      return;
    }

    fs.watchFile(outFile, (current, previous) => {
      if (current.size > 0) {
        console.log("VS Code Extension esbuild rebuild complete");
        fs.unwatchFile(outFile);
        process.exit(0);
      }
    });

    console.log("Triggering VS Code Extension esbuild rebuild...");
    writeBuildTimestamp();
  } else {
    await esbuild.build(esbuildConfig);
  }
})();
