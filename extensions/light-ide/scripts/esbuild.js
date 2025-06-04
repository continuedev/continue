const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const flags = process.argv.slice(2);

const outFile = "out/index.js";

const esbuildConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: outFile,
  sourcemap: flags.includes("--sourcemap"),
  external: [
    "express",        
    "esbuild",        
    "./xhr-sync-worker.js"
  ],
  metafile: true,
  loader: {
    ".ts": "ts",
    ".node": "file",
  },
  define: {
    "import.meta.url": JSON.stringify(""),
  },
  plugins: [
    {
      name: "on-end",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) {
            console.error("Build failed:", result.errors);
            process.exit(1);
          } else {
            console.log("Light IDE build complete");
          }
        });
      },
    },
  ]
};

(async () => {
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
  } else {
    await esbuild.build(esbuildConfig);
  }
})();
