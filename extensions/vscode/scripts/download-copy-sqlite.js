const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const { ProxyAgent } = require("undici");
const { rimrafSync } = require("rimraf");

const { execCmdSync } = require("../../../scripts/util");

// Keep the pre-built binary in lockstep with the sqlite3 version actually
// installed in core, so a dependency bump can't silently leave us unpacking a
// mismatched native binding over it.
const SQLITE_VERSION =
  require("../../../core/node_modules/sqlite3/package.json").version;

// node-sqlite3 publishes both napi-v3 and napi-v6 builds for every target it
// supports. napi-v6 needs Node >=18.17, which our engines floor already
// requires, so prefer it everywhere.
const NAPI_VERSION = 6;

// Targets we know node-sqlite3 publishes a prebuild for. `target` reaches a
// shell via execCmdSync in utils.js, and is interpolated into a download URL
// in both scripts, so validate it before use: a typo should fail loudly here
// rather than 404 or reach the shell.
const SUPPORTED_SQLITE_TARGETS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "win32-x64",
  // No upstream prebuild — served from our own mirror, see sqliteDownloadUrl.
  "win32-arm64",
]);

/**
 * Resolve the prebuilt sqlite3 URL for a target, validating the target first.
 * @param {string} target platform specific target, e.g. "linux-x64"
 * @returns {string}
 */
function sqliteDownloadUrl(target) {
  if (!SUPPORTED_SQLITE_TARGETS.has(target)) {
    throw new Error(
      `Unsupported sqlite3 target: ${JSON.stringify(target)}. Expected one of: ${[
        ...SUPPORTED_SQLITE_TARGETS,
      ].join(", ")}`,
    );
  }

  // node-sqlite3 has never published a win32-arm64 asset (checked for 5.1.7
  // and 6.0.1), so that target is served from our own mirror.
  // FIXME: the mirrored archive is unversioned and still contains SQLite
  // 3.44.2 (sqlite3 v5 era) while every other target now ships 3.52.0. It is
  // currently unreachable — win32-arm64 is commented out of package-all.js
  // for exactly this reason — but re-enabling that target requires rebuilding
  // the mirror against SQLITE_VERSION and storing it under a versioned key.
  if (target === "win32-arm64") {
    return "https://continue-server-binaries.s3.us-west-1.amazonaws.com/win32-arm64/node_sqlite3.tar.gz";
  }

  return `https://github.com/TryGhost/node-sqlite3/releases/download/v${SQLITE_VERSION}/sqlite3-v${SQLITE_VERSION}-napi-v${NAPI_VERSION}-${target}.tar.gz`;
}

/**
 * download a file using fetch API
 * @param {string} url
 * @param {string} outputPath
 */
async function downloadFile(url, outputPath) {
  // Use proxy if set in environment variables
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  const agent = proxy ? new ProxyAgent(proxy) : undefined;

  const response = await fetch(url, {
    redirect: "follow", // Automatically follow redirects
    dispatcher: agent,
  });

  if (!response.ok) {
    throw new Error(`Failed to download file, status code: ${response.status}`);
  }

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get the response as an array buffer and write it to the file
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

/**
 *
 * @param {string} target platform specific target
 * @param {string} targetDir the directory to download into
 */
async function downloadSqlite(target, targetDir) {
  await downloadFile(sqliteDownloadUrl(target), targetDir);
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
  sqliteDownloadUrl,
  SUPPORTED_SQLITE_TARGETS,
  copySqlite,
  copyEsbuild,
};
