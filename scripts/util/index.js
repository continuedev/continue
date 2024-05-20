const fs = require("fs");
const { execSync } = require("child_process");

function execCmdSync(cmd) {
  try {
    execSync(cmd);
  } catch (err) {
    console.error(`Error executing command '${cmd}': `, err.output.toString());
    process.exit(1);
  }
}

function validateFilesPresent(pathsToVerify) {
  // This script verifies after pacakging that necessary files are in the correct locations
  // In many cases just taking a sample file from the folder when they are all roughly the same thing

  let missingFiles = [];
  for (const path of pathsToVerify) {
    if (!fs.existsSync(path)) {
      const parentFolder = path.split("/").slice(0, -1).join("/");
      const grandparentFolder = path.split("/").slice(0, -2).join("/");
      const grandGrandparentFolder = path.split("/").slice(0, -3).join("/");

      console.error(`File ${path} does not exist`);
      if (!fs.existsSync(parentFolder)) {
        console.error(`Parent folder ${parentFolder} does not exist`);
      } else {
        console.error(
          "Contents of parent folder:",
          fs.readdirSync(parentFolder),
        );
      }
      if (!fs.existsSync(grandparentFolder)) {
        console.error(`Grandparent folder ${grandparentFolder} does not exist`);
        if (!fs.existsSync(grandGrandparentFolder)) {
          console.error(
            `Grandgrandparent folder ${grandGrandparentFolder} does not exist`,
          );
        } else {
          console.error(
            "Contents of grandgrandparent folder:",
            fs.readdirSync(grandGrandparentFolder),
          );
        }
      } else {
        console.error(
          "Contents of grandparent folder:",
          fs.readdirSync(grandparentFolder),
        );
      }

      missingFiles.push(path);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `The following files were missing:\n- ${missingFiles.join("\n- ")}`,
    );
  } else {
    console.log("All paths exist");
  }
}

module.exports = {
  execCmdSync,
  validateFilesPresent,
};
