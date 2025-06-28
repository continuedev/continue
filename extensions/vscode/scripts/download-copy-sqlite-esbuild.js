const { fork } = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const { rimrafSync } = require("rimraf");

const { execCmdSync } = require("../../../scripts/util");

/**
 * download a file using nodejs http
 * @param {string} url
 * @param {string} outputPath
 * @param {number} maxRedirects
 */
async function downloadFile(url, outputPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const downloadWithRedirects = (currentUrl, redirectCount = 0) => {
      if (redirectCount > maxRedirects) {
        return reject(new Error(`Too many redirects (${maxRedirects})`));
      }

      const request = https.get(currentUrl, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          return downloadWithRedirects(
            response.headers.location,
            redirectCount + 1,
          );
        }

        if (response.statusCode !== 200) {
          return reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
          );
        }

        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const writeStream = fs.createWriteStream(outputPath);

        const totalSize = parseInt(response.headers["content-length"], 10);
        let downloadedSize = 0;

        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(
              `\rDownloading: ${percent}% (${downloadedSize}/${totalSize} bytes)`,
            );
          }
        });

        response.pipe(writeStream);

        writeStream.on("finish", () => {
          console.log(`\nDownload completed: ${outputPath}`);
          resolve(outputPath);
        });

        writeStream.on("error", reject);
        response.on("error", reject);
      });

      request.on("error", reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    };

    downloadWithRedirects(url);
  });
}

/**
 *
 * @param {string} target platform specific target
 * @param {string} targetDir the directory to download into
 */
async function downloadSqlite(target, targetDir) {
  const downloadUrl =
    // node-sqlite3 doesn't have a pre-built binary for win32-arm64
    target === "win32-arm64"
      ? "https://continue-server-binaries.s3.us-west-1.amazonaws.com/win32-arm64/node_sqlite3.tar.gz"
      : `https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-${
          target
        }.tar.gz`;
  await downloadFile(downloadUrl, targetDir);
}

async function installAndCopySqlite(target) {
  // Replace the installed with pre-built
  console.log("[info] Downloading pre-built sqlite3 binary");
  rimrafSync("../../core/node_modules/sqlite3/build");
  await downloadSqlite(target, "../../core/node_modules/sqlite3/build.tar.gz");
  execCmdSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");
  fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
}

async function installAndCopyEsbuild(target) {
  // Download and unzip esbuild
  console.log("[info] Downloading pre-built esbuild binary");
  rimrafSync("node_modules/@esbuild");
  fs.mkdirSync("node_modules/@esbuild", { recursive: true });
  await downloadFile(
    `https://continue-server-binaries.s3.us-west-1.amazonaws.com/${target}/esbuild.zip`,
    "node_modules/@esbuild/esbuild.zip",
  );
  execCmdSync("cd node_modules/@esbuild && unzip esbuild.zip");
  fs.unlinkSync("node_modules/@esbuild/esbuild.zip");
}

process.on("message", (msg) => {
  const { operation, target } = msg.payload;
  if (operation === "sqlite") {
    installAndCopySqlite(target)
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
  if (operation === "esbuild") {
    installAndCopyEsbuild(target)
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
});

/**
 * @param {string} target the platform to build for
 */
async function copySqlite(target) {
  const child = fork(__filename, { stdio: "inherit", cwd: process.cwd() });
  child.send({
    payload: {
      operation: "sqlite",
      target,
    },
  });

  return new Promise((resolve, reject) => {
    child.on("message", (msg) => {
      if (msg.error) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

/**
 * @param {string} target the platform to build for
 */
async function copyEsbuild(target) {
  const child = fork(__filename, { stdio: "inherit", cwd: process.cwd() });
  child.send({
    payload: {
      operation: "esbuild",
      target,
    },
  });

  return new Promise((resolve, reject) => {
    child.on("message", (msg) => {
      if (msg.error) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  downloadSqlite,
  copySqlite,
  copyEsbuild,
};
