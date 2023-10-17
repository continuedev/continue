const { exec } = require("child_process");
const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");

exec("npm install", (error) => {
  if (error) throw error;
  console.log("npm install completed");

  exec("npm run typegen", (error) => {
    if (error) throw error;
    console.log("npm run typegen completed");

    process.chdir("react-app");

    exec("npm install", (error) => {
      if (error) throw error;
      console.log("npm install in react-app completed");

      exec("npm run build", (error) => {
        // Then copy over the dist folder to the Intellij extension
        // cp ../../intellij-extension/src/main/resources/webview/index.html tmp_index.html && rm -rf ../../intellij-extension/src/main/resources/webview && mkdir ../../intellij-extension/src/main/resources/webview && cp -R dist/* ../../intellij-extension/src/main/resources/webview && cp tmp_index.html ../../intellij-extension/src/main/resources/webview/index.html && rm tmp_index.html
        fs.copyFileSync(
          path.join(
            "..",
            "..",
            "intellij-extension",
            "src",
            "main",
            "resources",
            "webview",
            "index.html"
          ),
          path.join("tmp_index.html")
        );
        fs.rmSync(
          path.join(
            "..",
            "..",
            "intellij-extension",
            "src",
            "main",
            "resources",
            "webview"
          ),
          { recursive: true }
        );
        fs.mkdirSync(
          path.join(
            "..",
            "..",
            "intellij-extension",
            "src",
            "main",
            "resources",
            "webview"
          ),
          { recursive: true }
        );
        ncp(
          "dist",
          path.join(
            "..",
            "..",
            "intellij-extension",
            "src",
            "main",
            "resources",
            "webview"
          ),
          (error) => {
            if (error) {
              console.log(
                "Error copying react-app build to intellij-extension: ",
                error
              );
              throw error;
            }

            const indexHtmlPath = path.join(
              "..",
              "..",
              "intellij-extension",
              "src",
              "main",
              "resources",
              "webview",
              "index.html"
            );
            if (fs.existsSync(indexHtmlPath)) {
              fs.rmSync(indexHtmlPath, {});
            }
            fs.copyFileSync(
              "tmp_index.html",
              path.join(
                "..",
                "..",
                "intellij-extension",
                "src",
                "main",
                "resources",
                "webview",
                "index.html"
              )
            );
            fs.unlinkSync("tmp_index.html");
            console.log("Copied react-app build to intellij-extension");
          }
        );

        if (error) {
          console.log("Error running npm run build in react-app: ", error);
          throw error;
        }
        if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
          throw new Error("react-app build did not produce index.js");
        }
        if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
          throw new Error("react-app build did not produce index.css");
        }
        console.log("npm run build in react-app completed");
      });
    });
  });
});
