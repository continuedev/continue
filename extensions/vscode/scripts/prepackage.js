const { exec } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");

if (!process.cwd().endsWith("vscode")) {
  // This is sometimes run from root dir instead (e.g. in VS Code tasks)
  process.chdir("extensions/vscode");
}
exec("npm install", (error) => {
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
      console.log(process.cwd());
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
