const esbuild = require("esbuild");

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

    // To allow import.meta.path for transformers.js
    // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
    inject: ["./importMetaUrl.js"],
    define: { "import.meta.url": "importMetaUrl" },
  });
})();
