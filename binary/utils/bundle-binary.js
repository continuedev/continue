/**
 * @file Builds the binary for the specified target. It is also intended to run as a child process.
 */

const {
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../../scripts/util");
const { downloadRipgrep } = require("./ripgrep");
const { TARGET_TO_LANCEDB } = require("../utils/targets");
const fs = require("fs");
const {
  downloadSqlite,
} = require("../../extensions/vscode/scripts/download-copy-sqlite");
const { fork } = require("child_process");

async function downloadNodeSqlite(target, targetDir) {
  const [currentPlatform, currentArch] = autodetectPlatformAndArch();

  // Download and unzip prebuilt sqlite3 binary for the target
  console.log("[info] Downloading node-sqlite3");

  await downloadSqlite(target, `${targetDir}/build.tar.gz`);

  execCmdSync(`cd ${targetDir} && tar -xvzf build.tar.gz`);

  // Copy to build directory for testing
  try {
    const [platform, arch] = target.split("-");
    if (platform === currentPlatform && arch === currentArch) {
      fs.copyFileSync(
        `${targetDir}/build/Release/node_sqlite3.node`,
        `build/node_sqlite3.node`,
      );
    }
  } catch (error) {
    console.log("[warn] Could not copy node_sqlite to build");
    console.log(error);
  }
  fs.unlinkSync(`${targetDir}/build.tar.gz`);
}

/**
 * @param {string} target the platform to build for
 */
async function bundleForBinary(target) {
  const targetDir = `bin/${target}`;
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`[info] Building ${target}...`);
  execCmdSync(
    `npx pkg --no-bytecode --public-packages "*" --public --compress GZip pkgJson/${target} --out-path ${targetDir}`,
  );

  // copy @lancedb to bin folders
  console.log("[info] Copying @lancedb files to bin");
  fs.copyFileSync(
    `node_modules/${TARGET_TO_LANCEDB[target]}/index.node`,
    `${targetDir}/index.node`,
  );

  const downloadPromises = [];
  downloadPromises.push(downloadRipgrep(target, targetDir));
  downloadPromises.push(downloadNodeSqlite(target, targetDir));
  await Promise.all(downloadPromises);

  // Informs the `continue-binary` of where to look for node_sqlite3.node
  // https://www.npmjs.com/package/bindings#:~:text=The%20searching%20for,file%20is%20found
  fs.writeFileSync(`${targetDir}/package.json`, "");
}

process.on("message", (msg) => {
  bundleForBinary(msg.payload.target)
    .then(() => process.send({ done: true }))
    .catch((error) => {
      console.error(error); // show the error in the parent process
      process.send({ error: true });
    });
});

/**
 * @param {string} target the platform to bundle for
 */
async function bundleBinary(target) {
  const child = fork(__filename, { stdio: "inherit" });
  child.send({
    payload: {
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
  bundleBinary,
};
