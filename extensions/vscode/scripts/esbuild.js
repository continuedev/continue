const esbuild = require("esbuild");

const flags = process.argv.slice(2);

const esbuildConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "esbuild", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  sourcemap: flags.includes("--sourcemap"),
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
  supported: { "dynamic-import": false },
};

// Build our whisper / voiceInputWorker with @xenova/transformers dependency
const whisperWorkerBuildConfig = {
  entryPoints: ["../../core/util/voiceInputWorker.ts"],
  bundle: true,
  outfile: "out/voiceInputWorker.js",
  external: ["./vendor/modules/@xenova/transformers"],
  format: "cjs",
  platform: "node",
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
  supported: { "dynamic-import": false },
};

(async () => {
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();

    const whisperCtx = await esbuild.context(whisperWorkerBuildConfig);
    await whisperCtx.watch();
  } else {
    await esbuild.build(esbuildConfig);
    await esbuild.build(whisperWorkerBuildConfig);
  }
})();
