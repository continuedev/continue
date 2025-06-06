/**
 * @file Install node modules for the VS Code extension and gui. This is also intended to run as a child process.
 */

const { fork } = require("child_process");
const path = require("path");

const { execCmdSync } = require("../../../scripts/util");

const { continueDir } = require("./utils");

async function installNodeModulesInGui() {
  process.chdir(path.join(continueDir, "gui"));
  execCmdSync("npm install");
  console.log("[info] npm install in gui completed");
}

async function installNodeModulesInVscode() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  execCmdSync("npm install");
  console.log("[info] npm install in extensions/vscode completed");
}

process.on("message", (msg) => {
  const { targetDir } = msg.payload;
  if (targetDir === "gui") {
    installNodeModulesInGui()
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  } else if (targetDir === "vscode") {
    installNodeModulesInVscode()
      .then(() => process.send({ done: true }))
      .catch((error) => {
        console.error(error); // show the error in the parent process
        process.send({ error: true });
      });
  }
});

async function npmInstall() {
  const installVscodeChild = fork(__filename, {
    stdio: "inherit",
  });
  installVscodeChild.send({ payload: { targetDir: "vscode" } });

  const installGuiChild = fork(__filename, {
    stdio: "inherit",
  });
  installGuiChild.send({ payload: { targetDir: "gui" } });

  await Promise.all([
    new Promise((resolve, reject) => {
      installVscodeChild.on("message", (msg) => {
        if (msg.error) {
          reject();
        }
        resolve();
      });
    }),
    new Promise((resolve, reject) => {
      installGuiChild.on("message", (msg) => {
        if (msg.error) {
          reject();
        }
        resolve();
      });
    }),
  ]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  npmInstall,
};
