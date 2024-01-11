const { build } = require("esbuild");

build({
  entryPoints: ["worker.ts"],
  bundle: true,
  outfile: "dist/worker.js",
  platform: "browser",
  sourcemap: true,
}).catch(() => process.exit(1));
