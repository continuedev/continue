/**
 * @file Copy lancedb to the current directory. It is intended to run as a child process.
 */

const fs = require("fs");
const path = require("path");
const ncp = require("ncp").ncp;
const { execCmdSync } = require("../../scripts/util");

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`Copying ${packageName} to ${toCopy}`);
  // This is a way to install only one package without npm trying to install all the dependencies
  // Create a temporary directory for installing the package
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");
  const tempDir = path.join(
    __dirname,
    "..",
    "tmp",
    `continue-node_modules-${adjustedName}`,
  );
  const currentDir = process.cwd();

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
    // rimrafSync(tempDir);

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
