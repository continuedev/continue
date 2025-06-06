/**
 * @file Install node modules for the VS Code extension. This is intended to run as a child process.
 */

const path = require("path");

const { execCmdSync } = require("../../../scripts/util");

/**
 * @param {string} continueDir
 */
async function installNodeModulesInGui(continueDir) {
  process.chdir(path.join(continueDir, "gui"));
  execCmdSync("npm install");
  console.log("[info] npm install in gui completed");
}

async function installNodeModulesInVscode(continueDir) {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  execCmdSync("npm install");
  console.log("[info] npm install in extensions/vscode completed");
}

process.on("message", (msg) => {
  const { continueDir, targetDir } = msg.payload;
  if (targetDir === "gui") {
    installNodeModulesInGui(continueDir)
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  } else if (targetDir === "vscode") {
    installNodeModulesInVscode(continueDir)
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
});
