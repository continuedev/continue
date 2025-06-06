/**
 * @file Builds the binary for the specified target. It is intended to run as a child process.
 */
const {
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../../scripts/util");
const { downloadRipgrep } = require("./ripgrep");
const { TARGET_TO_LANCEDB } = require("../utils/targets");
const fs = require("fs");

/**
 * @param {string} target the platform to build for
 */
async function bundleForBinary(target) {
  const [currentPlatform, currentArch] = autodetectPlatformAndArch();

  const targetDir = `bin/${target}`;
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`[info] Building ${target}...`);
  execCmdSync(
    `npx pkg --no-bytecode --public-packages "*" --public --compress GZip pkgJson/${target} --out-path ${targetDir}`,
  );

  // Download and unzip prebuilt sqlite3 binary for the target
  console.log("[info] Downloading node-sqlite3");

  const downloadUrl =
    // node-sqlite3 doesn't have a pre-built binary for win32-arm64
    target === "win32-arm64"
      ? "https://continue-server-binaries.s3.us-west-1.amazonaws.com/win32-arm64/node_sqlite3.tar.gz"
      : `https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-${
          target
        }.tar.gz`;

  execCmdSync(`curl -L -o ${targetDir}/build.tar.gz ${downloadUrl}`);
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

  // copy @lancedb to bin folders
  console.log("[info] Copying @lancedb files to bin");
  fs.copyFileSync(
    `node_modules/${TARGET_TO_LANCEDB[target]}/index.node`,
    `${targetDir}/index.node`,
  );

  // Download and install ripgrep for the target
  await downloadRipgrep(target, targetDir);

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
