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

function autodetectPlatformAndArch() {
  platform = {
    aix: "linux",
    alpine: "linux",
    darwin: "darwin",
    freebsd: "linux",
    linux: "linux",
    openbsd: "linux",
    sunos: "linux",
    win32: "win32",
  }[process.platform];
  arch = {
    arm: "arm64",
    armhf: "arm64",
    arm64: "arm64",
    ia32: "x64",
    loong64: "arm64",
    mips: "arm64",
    mipsel: "arm64",
    ppc: "x64",
    ppc64: "x64",
    riscv64: "arm64",
    s390: "x64",
    s390x: "x64",
    x64: "x64",
  }[process.arch];
  return [platform, arch];
}

function validateFilesPresent(pathsToVerify) {
  // This script verifies after pacakging that necessary files are in the correct locations
  // In many cases just taking a sample file from the folder when they are all roughly the same thing

  let missingFiles = [];
  let emptyFiles = [];
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

    if (fs.existsSync(path) && fs.statSync(path).size === 0) {
      console.error(`File ${path} is empty`);
      emptyFiles.push(path);
    }
  }

  if (missingFiles.length > 0 || emptyFiles.length > 0) {
    throw new Error(
      `The following files were missing:\n- ${missingFiles.join(
        "\n- ",
      )}\n\nThe following files were empty:\n- ${emptyFiles.join("\n- ")}`,
    );
  } else {
    console.log("All paths exist");
  }
}

module.exports = {
  execCmdSync,
  validateFilesPresent,
  autodetectPlatformAndArch,
};
