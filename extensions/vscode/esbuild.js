const esbuild = require("esbuild");
const ncp = require("ncp").ncp;
const fs = require("fs");
const { execSync } = require("child_process");
const { rimrafSync } = require("rimraf");
const path = require("path");

function ghAction() {
  return process.env.target !== undefined;
}

function isArm() {
  return (
    process.env.target === "darwin-arm64" ||
    process.env.target === "linux-arm64" ||
    process.env.target === "win32-arm64"
  );
}

function isWin() {
  return process.env.target?.startsWith("win");
}

(async () => {
  console.log("Bundling with esbuild for target ", process.env.target);

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

  // GitHub Actions doesn't support ARM, so we need to download pre-saved binaries
  if (ghAction() && isArm()) {
    // Neither lancedb nor sqlite3 have pre-built windows arm64 binaries
    if (!isWin()) {
      // lancedb binary
      console.log("Downloading pre-built lancedb binary");
      rimrafSync("node_modules/@lancedb");
      const packageToInstall = {
        "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
        "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
      }[process.env.target];
      execSync(`npm install -f ${packageToInstall}`);
    }

    // Download and unzip esbuild
    console.log("Downloading pre-built esbuild binary");
    rimrafSync("node_modules/@esbuild");
    fs.mkdirSync("node_modules/@esbuild", { recursive: true });
    execSync(
      `curl -o node_modules/@esbuild/esbuild.zip https://continue-server-binaries.s3.us-west-1.amazonaws.com/${process.env.target}/esbuild.zip`
    );
    execSync(`cd node_modules/@esbuild && unzip esbuild.zip`);
    fs.unlinkSync("node_modules/@esbuild/esbuild.zip");
  }

  if (ghAction()) {
    // sqlite3
    if (isArm() && !isWin()) {
      // Replace the installed with pre-built
      console.log("Downloading pre-built sqlite3 binary");
      rimrafSync("../../core/node_modules/sqlite3/build");
      const downloadUrl = {
        "darwin-arm64":
          "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
        "linux-arm64":
          "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
      }[process.env.target];
      execSync(
        `curl -L -o ../../core/node_modules/sqlite3/build.tar.gz ${downloadUrl}`
      );
      execSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");
      fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
    }

    ncp(
      path.join(__dirname, "../../core/node_modules/sqlite3/build"),
      path.join(__dirname, "out/build"),
      (error) => {
        if (error) console.warn("Error copying sqlite3 files", error);
      }
    );
  }

  // Copy node_modules for pre-built binaries
  const NODE_MODULES_TO_COPY = ["esbuild", "@esbuild", "@lancedb"];
  fs.mkdirSync("out/node_modules", { recursive: true });
  NODE_MODULES_TO_COPY.forEach((mod) => {
    ncp.ncp(`node_modules/${mod}`, `out/node_modules/${mod}`, function (err) {
      if (err) {
        return console.error(err);
      }
    });
  });
})();
