const esbuild = require("esbuild");

(async () => {
  // Bundles the extension into one file
  await esbuild.build({
    entryPoints: ["crawl.ts"],
    bundle: true,
    outfile: "crawl.js",
    external: [],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    target: "es2015",
    loader: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ".node": "file",
    },
  });
})();
