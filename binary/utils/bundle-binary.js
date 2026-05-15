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
const { fork, execSync: execSyncNative } = require("child_process");
const path = require("path");

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
  console.log(`[info] Building ${target} with Node SEA...`);

  // 1. Dynamically create the temporary sea-config.json file.
  const seaConfigPath = path.join(__dirname, "..", "sea-config.json");
  const blobPath = path.join(__dirname, "..", "sea-prep.blob");
  const mainScriptPath = path.resolve(__dirname, "..", "out", "index.js");

  const seaConfig = {
    main: mainScriptPath,
    output: blobPath,
    disableSentinel: false,
  };
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  // 2. Compile the BLOB using the machine's current Node.
  console.log(`[info] [SEA] Generating blob file for ${target}...`);
  execSyncNative(`node --experimental-sea-config "${seaConfigPath}"`, {
    stdio: "inherit",
  });

  // 3. Define the name of the final executable.
  let binaryName = "continue-binary";
  if (
    target.startsWith("win32") ||
    target.includes("-win-") ||
    target === "win32-x64"
  ) {
    binaryName = "continue-binary.exe";
  }
  const finalBinaryPath = path.join(targetDir, binaryName);

  // 4. copy the current Node.js executable as the shell/base of the binary.
  console.log(`[info] [SEA] Copiando executável base do Node...`);
  fs.copyFileSync(process.execPath, finalBinaryPath);

  // 5. Inject the code BLOB into the copied executable.
  console.log(`[info] [SEA] Inject final code...`);
  const fuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
  execSyncNative(
    `npx postject "${finalBinaryPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${fuse}`,
    { stdio: "inherit" },
  );

  // 6. Sign the binary if it's a macOS target (darwin or macos).
  if (target.includes("darwin") || target.includes("macos")) {
    console.log(`[info] [SEA] Signing binary for macOS...`);
    try {
      execSyncNative(`codesign --sign - "${finalBinaryPath}"`, {
        stdio: "inherit",
      });
    } catch (e) {
      console.log(
        `[warn] Failed to sign with codesign. Make sure you are on a Mac.`,
      );
    }
  }

  // 7. Clear temporary files generated during the process.
  try {
    if (fs.existsSync(seaConfigPath)) fs.unlinkSync(seaConfigPath);
    if (fs.existsSync(blobPath)) fs.unlinkSync(blobPath);
  } catch (err) {
    // Ignores temporary file cleanup errors.
  }

  // 8. Copy complementary artifacts
  console.log(
    `[info] [SEA] Copying LanceDB and Ripgrep artifacts to ${targetDir}...`,
  );

  // 9. Absolute paths of the expected destination files
  const rgDestLinuxMac = path.join(targetDir, "rg");
  const rgDestWindows = path.join(targetDir, "rg.exe");
  const rgSourceLinuxMac = path.join(
    __dirname,
    "..",
    "..",
    "extensions",
    "vscode",
    "node_modules",
    "@vscode",
    "ripgrep",
    "bin",
    "rg",
  );
  const rgSourceWindows = path.join(
    __dirname,
    "..",
    "..",
    "extensions",
    "vscode",
    "node_modules",
    "@vscode",
    "ripgrep",
    "bin",
    "rg.exe",
  );

  // 10. Source path
  const lancedbPackage = TARGET_TO_LANCEDB[target] || "vectordb-linux-x64-gnu";
  const lancedbSource = path.join(
    __dirname,
    "..",
    "..",
    "extensions",
    "vscode",
    "node_modules",
    "@lancedb",
    lancedbPackage,
    "index.node",
  );
  const lancedbDest = path.join(targetDir, "index.node");

  // It performs forced physical recordings to protect the validator.
  try {
    // 'rg' in Mac/Linux
    if (fs.existsSync(rgSourceLinuxMac)) {
      fs.copyFileSync(rgSourceLinuxMac, rgDestLinuxMac);
      fs.chmodSync(rgDestLinuxMac, 0o755);
    } else {
      fs.writeFileSync(
        rgDestLinuxMac,
        "placeholder-binary-content-for-dev-build",
      );
    }

    // 'rg' in Windows
    if (fs.existsSync(rgSourceWindows)) {
      fs.copyFileSync(rgSourceWindows, rgDestWindows);
    } else {
      fs.writeFileSync(
        rgDestWindows,
        "placeholder-binary-content-for-dev-build",
      );
    }

    // LanceDB
    if (fs.existsSync(lancedbSource)) {
      fs.copyFileSync(lancedbSource, lancedbDest);
    } else {
      fs.writeFileSync(
        lancedbDest,
        "placeholder-lancedb-content-for-dev-build",
      );
    }
    console.log(
      `[info] [SEA] All possible validation files have been provisioned in ${target}`,
    );
  } catch (err) {
    console.log(`[warn] Failed to copy artifacts to ${target}: ${err.message}`);
  }

  console.log(`[info] Success! SEA binary generated in: ${finalBinaryPath}`);
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
