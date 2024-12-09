const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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

// Promise that resolves when file isn't backing filePath
async function fileRemoval(filePath) {
  const resolvedPath = path.resolve(filePath);

  return new Promise((resolve) => {
    fs.watchFile(resolvedPath, (current, previous) => {
      if (current.size === 0)
        resolve(true);
    });

    if (!fs.existsSync(resolvedPath))
      resolve(true);
  });
}

// Function to monitor extension.js removal and trigger rebuilds
async function watchForExtensionFileRemoval(ctx, esbuildConfig) {
  queueMicrotask(async () => {
    while (await fileRemoval(esbuildConfig.outfile)) {
      console.log("VS Code Extension disappeared. Rebuilding...");
      try {
        await ctx.rebuild();
        console.log("VS Code Extension esbuild rebuild complete");
      } catch (error) {
        console.error("VS Code Extension esbuild rebuild failed:", error);
        break;
      }
    }
  });
}

(async () => {
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
    await watchForExtensionFileRemoval(ctx, esbuildConfig);
  } else {
    await esbuild.build(esbuildConfig);
  }
  console.log("VS Code Extension esbuild complete"); // Used in task endpattern to signal completion
})();
