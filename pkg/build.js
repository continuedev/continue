const esbuild = require("esbuild");
const { execSync } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;

const esbuildOutputFile = "out/index.js";

let esbuildOnly = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--esbuild-only") {
    esbuildOnly = true;
    break; // Exit the loop once the flag is found
  }
}

(async () => {
  //   console.log("[info] Building with ncc...");
  //   execSync(`npx ncc build src/index.ts -o out`);

  // Copy node_modules for pre-built binaries
  const DYNAMIC_IMPORTS = [
    "esbuild",
    "@esbuild",
    "@lancedb",
    "posthog-node",
    "@octokit",
  ];
  fs.mkdirSync("out/node_modules", { recursive: true });

  await Promise.all(
    DYNAMIC_IMPORTS.map(
      (mod) =>
        new Promise((resolve, reject) =>
          ncp(
            `node_modules/${mod}`,
            `out/node_modules/${mod}`,
            function (error) {
              if (error) {
                console.error(`[error] Error copying ${mod}`, error);
                reject(error);
              } else {
                resolve();
              }
            }
          )
        )
    )
  );
  console.log(`[info] Copied ${DYNAMIC_IMPORTS.join(", ")}`);

  console.log("[info] Building with esbuild...");
  // Bundles the extension into one file
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: esbuildOutputFile,
    external: DYNAMIC_IMPORTS,
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

  if (esbuildOnly) {
    return;
  }

  console.log("[info] Building binary with pkg...");
  execSync("npx pkg .");
  console.log("[info] Done!");
})();
