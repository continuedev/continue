const esbuild = require("esbuild");
const ncp = require("ncp").ncp;
const fs = require("fs");

(async () => {
  console.log("Bundling with esbuild...");

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

    // To allow import.meta.path for transformers.js
    // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
    inject: ["./importMetaUrl.js"],
    define: { "import.meta.url": "importMetaUrl" },
  });

  fs.mkdirSync("out/node_modules", { recursive: true });

  const NODE_MODULES_TO_COPY = ["esbuild", "@lancedb"];
  NODE_MODULES_TO_COPY.forEach((mod) => {
    ncp.ncp(`node_modules/${mod}`, `out/node_modules/${mod}`, function (err) {
      if (err) {
        return console.error(err);
      }
    });
  });

  // Return instead of copying if on ARM
  // This is an env var created in the GH Action
  // We will instead download the prebuilt binaries
  if (
    process.env.target === "darwin-arm64" ||
    process.env.target === "linux-arm64" ||
    process.env.target === "win-arm64"
  ) {
    console.log("Skipping copying binaries");
    return;
  }

  ncp.ncp("node_modules/@esbuild", "out/node_modules/@esbuild", function (err) {
    if (err) {
      return console.error(err);
    }
  });
})();
