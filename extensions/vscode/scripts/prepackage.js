const { execSync } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");

let target = undefined;
const args = process.argv;
if (args[2] === "--target") {
  target = args[3];
}

(async () => {
  console.log("Packaging extension for target ", target);

  // Copy config_schema.json to config.json in docs
  fs.copyFileSync(
    "config_schema.json",
    path.join("..", "..", "docs", "static", "schemas", "config.json")
  );

  if (!process.cwd().endsWith("vscode")) {
    // This is sometimes run from root dir instead (e.g. in VS Code tasks)
    process.chdir("extensions/vscode");
  }

  // Install node_modules //
  execSync("npm install");
  console.log("npm install in extensions/vscode completed");

  process.chdir("../../gui");

  execSync("npm install");
  console.log("npm install in gui completed");

  execSync("npm run build");

  // Copy over the dist folder to the Intellij extension //
  const intellijExtensionWebviewPath = path.join(
    "..",
    "extensions",
    "intellij",
    "src",
    "main",
    "resources",
    "webview"
  );

  const indexHtmlPath = path.join(intellijExtensionWebviewPath, "index.html");
  fs.copyFileSync(indexHtmlPath, "tmp_index.html");
  fs.rmSync(intellijExtensionWebviewPath, { recursive: true });
  fs.mkdirSync(intellijExtensionWebviewPath, { recursive: true });

  await new Promise((resolve, reject) => {
    ncp("dist", intellijExtensionWebviewPath, (error) => {
      if (error) {
        console.log(
          "Error copying React app build to Intellij extension: ",
          error
        );
        reject(error);
      }
      resolve();
    });
  });

  if (fs.existsSync(indexHtmlPath)) {
    fs.rmSync(indexHtmlPath, {});
  }
  fs.copyFileSync("tmp_index.html", indexHtmlPath);
  fs.unlinkSync("tmp_index.html");
  console.log("Copied gui build to Intellij extension");

  // Then copy over the dist folder to the VSCode extension //
  const vscodeGuiPath = path.join("../extensions/vscode/gui");
  fs.mkdirSync(vscodeGuiPath, { recursive: true });
  ncp("dist", vscodeGuiPath, (error) => {
    if (error) {
      console.log("Error copying React app build to VSCode extension: ", error);
      throw error;
    }
    console.log("Copied gui build to VSCode extension");
  });

  if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
    throw new Error("gui build did not produce index.js");
  }
  if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
    throw new Error("gui build did not produce index.css");
  }

  // Copy over native / wasm modules //
  if (!ghAction()) {
    return;
  }

  process.chdir("../extensions/vscode");

  // onnxruntime-node
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/onnxruntime-node/bin"),
      path.join(__dirname, "../bin"),
      (error) => {
        if (error) {
          console.warn("Error copying onnxruntime-node files", error);
          reject(error);
        }
        resolve();
      }
    );
  });
  if (target) {
    // If building for production, only need the binaries for current platform
    if (!target.startsWith("darwin")) {
      fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/darwin"), {
        recursive: true,
      });
    }
    if (!target.startsWith("linux")) {
      fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/linux"), {
        recursive: true,
      });
    }
    if (!target.startsWith("win")) {
      fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/win32"), {
        recursive: true,
      });
    }
  }
  console.log("Copied onnxruntime-node");

  // tree-sitter-wasms
  ncp(
    path.join(__dirname, "../../../core/node_modules/tree-sitter-wasms/out"),
    path.join(__dirname, "../out/tree-sitter-wasms"),
    (error) => {
      if (error) console.warn("Error copying tree-sitter-wasms files", error);
    }
  );

  fs.copyFileSync(
    path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
    path.join(__dirname, "../out/tree-sitter.wasm")
  );
  console.log("Copied tree-sitter wasms");

  function ghAction() {
    return target !== undefined;
  }

  function isArm() {
    return (
      target === "darwin-arm64" ||
      target === "linux-arm64" ||
      target === "win32-arm64"
    );
  }

  function isWin() {
    return target?.startsWith("win");
  }

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
      }[target];
      execSync(`npm install -f ${packageToInstall}`);
    }

    // Download and unzip esbuild
    console.log("Downloading pre-built esbuild binary");
    rimrafSync("node_modules/@esbuild");
    fs.mkdirSync("node_modules/@esbuild", { recursive: true });
    execSync(
      `curl -o node_modules/@esbuild/esbuild.zip https://continue-server-binaries.s3.us-west-1.amazonaws.com/${target}/esbuild.zip`
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
      }[target];
      execSync(
        `curl -L -o ../../core/node_modules/sqlite3/build.tar.gz ${downloadUrl}`
      );
      execSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");
      fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
    }

    ncp(
      path.join(__dirname, "../../../core/node_modules/sqlite3/build"),
      path.join(__dirname, "../out/build"),
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
