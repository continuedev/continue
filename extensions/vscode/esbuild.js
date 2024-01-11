const esbuild = require("esbuild");
const ncp = require("ncp").ncp;
const fs = require("fs");
const { exec } = require("child_process");

(async () => {
  // Bundles the extension into one file
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode", "esbuild", "../sync.node"],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    loader: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ".node": "file",
    },
  });

  exec("npm run build-release:rust", (error, stdout, stderr) => {
    if (error) {
      console.log("Error building sync.node");
      console.log("stdout: ", stdout);
      console.log("stderr: ", stderr);
      throw error;
    }

    if (process.env.target === "darwin-arm64") {
      // Remove the old binary
      exec("rm -rf sync.node", (error, stdout, stderr) => {
        if (error) {
          console.log("Error removing sync.node");
          console.log("stdout: ", stdout);
          console.log("stderr: ", stderr);
          throw error;
        }
      });

      // Download the prebuilt binary
      exec(
        "curl -L https://continue-server-binaries.s3.us-west-1.amazonaws.com/apple-silicon/sync.node -o sync.node",
        (error, stdout, stderr) => {
          if (error) {
            console.log("Error downloading sync.node");
            console.log("stdout: ", stdout);
            console.log("stderr: ", stderr);
            throw error;
          }
        }
      );
    } else {
      ncp.ncp("sync.node", "out/sync.node", (err) => {
        if (err) {
          return console.error(err);
        }
      });
    }

    fs.mkdirSync("out/node_modules", { recursive: true });

    ncp.ncp("node_modules/esbuild", "out/node_modules/esbuild", function (err) {
      if (err) {
        return console.error(err);
      }
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

    ncp.ncp(
      "node_modules/@esbuild",
      "out/node_modules/@esbuild",
      function (err) {
        if (err) {
          return console.error(err);
        }
      }
    );
  });
})();
