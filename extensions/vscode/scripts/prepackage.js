const { exec } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");

if (!process.cwd().endsWith("vscode")) {
  // This is sometimes run from root dir instead (e.g. in VS Code tasks)
  process.chdir("extensions/vscode");
}
exec("npm install", async (error) => {
  if (error) throw error;
  console.log("npm install completed");

  process.chdir("../../gui");

  exec("npm install", (error) => {
    if (error) throw error;
    console.log("npm install in gui completed");

    exec("npm run build", (error, stdout, stderr) => {
      if (error) {
        console.log("Error running npm run build in gui");
        console.log("stdout: ", stdout);
        console.log("stderr: ", stderr);
        throw error;
      }

      // Copy over some files required for native modules

      // sqlite3
      ncp(
        path.join(__dirname, "../../../core/node_modules/sqlite3/build"),
        path.join(__dirname, "../out/build"),
        (error) => {
          if (error) console.warn("Error copying sqlite3 files", error);
        }
      );

      // onnxruntime-node
      ncp(
        path.join(__dirname, "../../../core/node_modules/onnxruntime-node/bin"),
        path.join(__dirname, "../bin"),
        (error) => {
          if (error)
            console.warn("Error copying onnxruntime-node files", error);
        }
      );
      if (process.env.target) {
        // If building for production, only need the binaries for current platform
        if (!process.env.target.startsWith("darwin")) {
          fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/darwin"), {
            recursive: true,
          });
        }
        if (!process.env.target.startsWith("linux")) {
          fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/linux"), {
            recursive: true,
          });
        }
        if (!process.env.target.startsWith("win")) {
          fs.rmdirSync(path.join(__dirname, "../bin/napi-v3/win32"), {
            recursive: true,
          });
        }
      }

      // tree-sitter-wasms
      ncp(
        path.join(
          __dirname,
          "../../../core/node_modules/tree-sitter-wasms/out"
        ),
        path.join(__dirname, "../out/tree-sitter-wasms"),
        (error) => {
          if (error)
            console.warn("Error copying tree-sitter-wasms files", error);
        }
      );

      // Listing contents of the web-tree-sitter directory
      console.log("DIRNAME: ", __dirname);
      fs.readdir(
        path.join(__dirname, "../../../core/node_modules"),
        (err, files) => {
          if (err) {
            console.error("Error: " + err);
            return;
          }
          files.forEach((file) => {
            console.log("FILE: ", file);
          });
        }
      );

      // Your original code
      fs.copyFileSync(
        path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
        path.join(__dirname, "../out/tree-sitter.wasm")
      );

      // Then copy over the dist folder to the Intellij extension
      const intellijExtensionWebviewPath = path.join(
        "..",
        "extensions",
        "intellij",
        "src",
        "main",
        "resources",
        "webview"
      );
      const indexHtmlPath = path.join(
        intellijExtensionWebviewPath,
        "index.html"
      );
      fs.copyFileSync(indexHtmlPath, path.join("tmp_index.html"));
      fs.rmSync(intellijExtensionWebviewPath, { recursive: true });
      fs.mkdirSync(intellijExtensionWebviewPath, { recursive: true });

      ncp("dist", intellijExtensionWebviewPath, (error) => {
        if (error) {
          console.log(
            "Error copying React app build to Intellij extension: ",
            error
          );
          throw error;
        }

        if (fs.existsSync(indexHtmlPath)) {
          fs.rmSync(indexHtmlPath, {});
        }
        fs.copyFileSync("tmp_index.html", indexHtmlPath);
        fs.unlinkSync("tmp_index.html");
        console.log("Copied gui build to Intellij extension");
      });

      // Then copy over the dist folder to the VSCode extension
      const vscodeGuiPath = path.join("../extensions/vscode/gui");
      fs.mkdirSync(vscodeGuiPath, { recursive: true });
      ncp("dist", vscodeGuiPath, (error) => {
        if (error) {
          console.log(
            "Error copying React app build to VSCode extension: ",
            error
          );
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
      console.log("npm run build in gui completed");
    });
  });
});
