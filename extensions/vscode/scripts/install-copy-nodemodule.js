/**
 * @file Copy lancedb to the current directory. It is also intended to run as a child process.
 */

const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const ncp = require("ncp").ncp;
const { rimrafSync } = require("rimraf");

const { execCmdSync } = require("../../../scripts/util");

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`Copying ${packageName} to ${toCopy}`);
  // This is a way to install only one package without npm trying to install all the dependencies
  // Create a temporary directory for installing the package
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");
  const currentDir = process.cwd();
  const tempDir = path.join(
    currentDir,
    "tmp",
    `continue-node_modules-${adjustedName}`,
  );

  // // Remove the dir we will be copying to
  // rimrafSync(`node_modules/${toCopy}`);

  // // Ensure the temporary directory exists
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Move to the temporary directory
    process.chdir(tempDir);

    // Initialize a new package.json and install the package
    execCmdSync(`npm init -y && npm i -f ${packageName} --no-save`);

    console.log(
      `Contents of: ${packageName}`,
      fs.readdirSync(path.join(tempDir, "node_modules", toCopy)),
    );

    // Without this it seems the file isn't completely written to disk
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Remove existing destination directory to ensure fresh copy
    // ncp's clobber option doesn't reliably overwrite cached files
    const packageSubdir = packageName.replace("@lancedb/", "");
    const destDir = path.join(
      currentDir,
      "node_modules",
      toCopy,
      packageSubdir,
    );
    if (fs.existsSync(destDir)) {
      rimrafSync(destDir);
    }

    // Copy the installed package back to the current directory
    await new Promise((resolve, reject) => {
      ncp(
        path.join(tempDir, "node_modules", toCopy),
        path.join(currentDir, "node_modules", toCopy),
        { dereference: true },
        (error) => {
          if (error) {
            console.error(
              `[error] Error copying ${packageName} package`,
              error,
            );
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  } finally {
    // Clean up the temporary directory
    try {
      rimrafSync(tempDir);
    } catch (err) {
      console.warn("[warn] Failed to remove temp directory", tempDir, err);
    }

    // Return to the original directory
    process.chdir(currentDir);
  }
}

process.on("message", (msg) => {
  installNodeModuleInTempDirAndCopyToCurrent(
    msg.payload.packageName,
    msg.payload.toCopy,
  )
    .then(() => process.send({ done: true }))
    .catch((error) => {
      console.error(error); // show the error in the parent process
      process.send({ error: true });
    });
});

/**
 * invoke a child process to install a node module into temporary directory and copy it over into node modules
 * @param {string} packageName the module to install and copy
 * @param {string} toCopy directory to copy into inside node modules
 */
async function installAndCopyNodeModules(packageName, toCopy) {
  const child = fork(__filename, { stdio: "inherit", cwd: process.cwd() });
  child.send({
    payload: {
      packageName,
      toCopy,
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
  installAndCopyNodeModules,
};
