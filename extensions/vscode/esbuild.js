const esbuild = require("esbuild");
const ncp = require("ncp").ncp;
const fs = require("fs");

(async () => {
  // Bundles the extension into one file
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode", "esbuild"],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    loader: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ".node": "file",
    },
  });

  // Return instead of copying if on ARM Mac
  if (process.platform === "darwin" && process.arch === "arm64") {
    return;
  }

  fs.mkdirSync("out/node_modules", { recursive: true });

  ncp.ncp("node_modules/esbuild", "out/node_modules/esbuild", function (err) {
    if (err) {
      return console.error(err);
    }
  });

  ncp.ncp("node_modules/@esbuild", "out/node_modules/@esbuild", function (err) {
    if (err) {
      return console.error(err);
    }
  });
})();
