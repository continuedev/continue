const esbuild = require("esbuild");
const { execSync } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;

const esbuildOutputFile = "out/index.js";
const platforms = ["darwin", "linux", "win32"];
const architectures = ["x64", "arm64"];
let targets = platforms.flatMap((platform) =>
  architectures.map((arch) => `${platform}-${arch}`)
);

let esbuildOnly = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--esbuild-only") {
    esbuildOnly = true;
  }
  if (process.argv[i - 1] === "--target") {
    targets = [process.argv[i]];
  }
}

const targetToLanceDb = {
  "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
  "darwin-x64": "@lancedb/vectordb-darwin-x64",
  "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
  "linux-x64": "@lancedb/vectordb-linux-x64-gnu",
  "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
};

(async () => {
  //   console.log("[info] Building with ncc...");
  //   execSync(`npx ncc build src/index.ts -o out`);

  // Copy node_modules for pre-built binaries
  const DYNAMIC_IMPORTS = [
    // "esbuild",
    // "@esbuild",
    // // "@lancedb",
    // "posthog-node",
    // "@octokit",
  ];
  fs.mkdirSync("out/node_modules", { recursive: true });
  fs.mkdirSync("bin/node_modules", { recursive: true });

  await Promise.all(
    DYNAMIC_IMPORTS.map(
      (mod) =>
        new Promise((resolve, reject) => {
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
          );
          ncp(
            `node_modules/${mod}`,
            `bin/node_modules/${mod}`,
            function (error) {
              if (error) {
                console.error(`[error] Error copying ${mod}`, error);
                reject(error);
              } else {
                resolve();
              }
            }
          );
        })
    )
  );
  console.log(`[info] Copied ${DYNAMIC_IMPORTS.join(", ")}`);

  console.log("[info] Downloading prebuilt lancedb...");
  for (const target of targets) {
    if (targetToLanceDb[target]) {
      console.log(`[info] Downloading ${target}...`);
      execSync(`npm install -f ${targetToLanceDb[target]} --no-save`);
    }
  }

  console.log("[info] Building with esbuild...");
  // Bundles the extension into one file
  await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: esbuildOutputFile,
    external: ["esbuild", ...DYNAMIC_IMPORTS],
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

  console.log("[info] Building binaries with pkg...");
  for (const target of targets) {
    const targetDir = `bin/${target}`;
    console.log(`[info] Building ${target}...`);
    execSync(
      `npx pkg --no-bytecode --public-packages "*" --public pkgJson/${target} --out-path ${targetDir}`
    );

    // Download and unzip prebuilt sqlite3 binary for the target
    const downloadUrl = `https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-${
      target === "win32-arm64" ? "win32-ia32" : target
    }.tar.gz`;
    execSync(`curl -L -o ${targetDir}/build.tar.gz ${downloadUrl}`);
    execSync(`cd ${targetDir} && tar -xvzf build.tar.gz`);
    fs.copyFileSync(
      `${targetDir}/build/Release/node_sqlite3.node`,
      `${targetDir}/node_sqlite3.node`
    );
    fs.unlinkSync(`${targetDir}/build.tar.gz`);
    fs.rmSync(`${targetDir}/build`, {
      recursive: true,
      force: true,
    });

    // Download and unzip prebuilt esbuild binary for the target
    console.log(`[info] Downloading esbuild for ${target}...`);
    execSync(
      `curl -o ${targetDir}/esbuild.tgz https://registry.npmjs.org/@esbuild/${target}/-/${target}-0.19.11.tgz`
    );
    execSync(`tar -xzvf ${targetDir}/esbuild.tgz -C ${targetDir}`);
    if (target.startsWith("win32")) {
      fs.cpSync(`${targetDir}/package/esbuild.exe`, `${targetDir}/esbuild.exe`);
    } else {
      fs.cpSync(`${targetDir}/package/bin/esbuild`, `${targetDir}/esbuild`);
    }
    fs.rmSync(`${targetDir}/esbuild.tgz`);
    fs.rmSync(`${targetDir}/package`, {
      force: true,
      recursive: true,
    });
  }
  // execSync(
  //   `npx pkg out/index.js --target node18-darwin-arm64 --no-bytecode --public-packages "*" --public -o bin/pkg`
  // );
  console.log("[info] Done!");
})();
