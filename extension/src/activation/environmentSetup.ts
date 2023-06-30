import { getExtensionUri } from "../util/vscode";
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const { spawn } = require("child_process");
import * as path from "path";
import * as fs from "fs";
import rebuild from "@electron/rebuild";
import { getContinueServerUrl } from "../bridge";
import fetch from "node-fetch";
import * as vscode from "vscode";

const MAX_RETRIES = 5;
async function retryThenFail(
  fn: () => Promise<any>,
  retries: number = MAX_RETRIES
): Promise<any> {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      return await retryThenFail(fn, retries - 1);
    }
    vscode.window.showErrorMessage(
      "Failed to set up Continue extension. Please email nate@continue.dev and we'll get this fixed ASAP!"
    );
    throw e;
  }
}

async function runCommand(cmd: string): Promise<[string, string | undefined]> {
  console.log("Running command: ", cmd);
  var stdout: any = "";
  var stderr: any = "";
  try {
    var { stdout, stderr } = await exec(cmd, {
      shell: process.platform === "win32" ? "powershell.exe" : undefined,
    });
  } catch (e: any) {
    stderr = e.stderr;
    stdout = e.stdout;
  }
  if (stderr === "") {
    stderr = undefined;
  }
  if (typeof stdout === "undefined") {
    stdout = "";
  }

  return [stdout, stderr];
}

async function getPythonPipCommands() {
  var [stdout, stderr] = await runCommand("python3 --version");
  let pythonCmd = "python3";
  if (stderr) {
    // If not, first see if python3 is aliased to python
    var [stdout, stderr] = await runCommand("python --version");
    if (
      (typeof stderr === "undefined" || stderr === "") &&
      stdout.split(" ")[1][0] === "3"
    ) {
      // Python3 is aliased to python
      pythonCmd = "python";
    } else {
      // Python doesn't exist at all
      vscode.window.showErrorMessage(
        "Continue requires Python3. Please install from https://www.python.org/downloads, reload VS Code, and try again."
      );
      throw new Error("Python 3.7 or greater is not installed.");
    }
  }

  const version = stdout.split(" ")[1];
  if (version < "3.7") {
    vscode.window.showErrorMessage(
      "Continue requires Python3 version 3.7 or greater. Please update your Python3 installation, reload VS Code, and try again."
    );
    throw new Error("Python3 is not installed.");
  }
  const pipCmd = pythonCmd.endsWith("3") ? "pip3" : "pip";
  return [pythonCmd, pipCmd];
}

function getActivateUpgradeTouchCommands(pythonCmd: string, pipCmd: string) {
  let activateCmd = ". env/bin/activate";
  let pipUpgradeCmd = `${pipCmd} install --upgrade pip`;
  let touchCmd = "touch .continue_env_installed";
  if (process.platform == "win32") {
    activateCmd = ".\\env\\Scripts\\activate";
    pipUpgradeCmd = `${pythonCmd} -m pip install --upgrade pip`;
    touchCmd = "ni .continue_env_installed -type file";
  }
  return [activateCmd, pipUpgradeCmd, touchCmd];
}

function checkEnvExists() {
  const envBinPath = path.join(
    getExtensionUri().fsPath,
    "scripts",
    "env",
    process.platform == "win32" ? "Scripts" : "bin"
  );
  return (
    fs.existsSync(path.join(envBinPath, "activate")) &&
    fs.existsSync(
      path.join(envBinPath, process.platform == "win32" ? "pip.exe" : "pip")
    )
  );
}

function checkRequirementsInstalled() {
  let envLibsPath = path.join(
    getExtensionUri().fsPath,
    "scripts",
    "env",
    process.platform == "win32" ? "Lib" : "lib"
  );
  // If site-packages is directly under env, use that
  if (fs.existsSync(path.join(envLibsPath, "site-packages"))) {
    envLibsPath = path.join(envLibsPath, "site-packages");
  } else {
    // Get the python version folder name
    const pythonVersions = fs.readdirSync(envLibsPath).filter((f: string) => {
      return f.startsWith("python");
    });
    if (pythonVersions.length == 0) {
      return false;
    }
    const pythonVersion = pythonVersions[0];
    envLibsPath = path.join(envLibsPath, pythonVersion, "site-packages");
  }

  const continuePath = path.join(envLibsPath, "continuedev");

  return fs.existsSync(continuePath);

  // return fs.existsSync(
  //   path.join(getExtensionUri().fsPath, "scripts", ".continue_env_installed")
  // );
}

async function setupPythonEnv() {
  console.log("Setting up python env for Continue extension...");

  const [pythonCmd, pipCmd] = await getPythonPipCommands();
  const [activateCmd, pipUpgradeCmd, touchCmd] =
    getActivateUpgradeTouchCommands(pythonCmd, pipCmd);

  if (checkEnvExists()) {
    console.log("Python env already exists, skipping...");
  } else {
    // Assemble the command to create the env
    const createEnvCommand = [
      `cd "${path.join(getExtensionUri().fsPath, "scripts")}"`,
      `${pythonCmd} -m venv env`,
    ].join(" ; ");

    // Repeat until it is successfully created (sometimes it fails to generate the bin, need to try again)
    while (true) {
      const [, stderr] = await runCommand(createEnvCommand);
      if (checkEnvExists()) {
        break;
      } else if (stderr) {
        throw new Error(stderr);
      } else {
        // Remove the env and try again
        const removeCommand = `rm -rf "${path.join(
          getExtensionUri().fsPath,
          "scripts",
          "env"
        )}"`;
        await runCommand(removeCommand);
      }
    }
    console.log(
      "Successfully set up python env at ",
      getExtensionUri().fsPath + "/scripts/env"
    );
  }

  await retryThenFail(async () => {
    if (checkRequirementsInstalled()) {
      console.log("Python requirements already installed, skipping...");
    } else {
      const installRequirementsCommand = [
        `cd "${path.join(getExtensionUri().fsPath, "scripts")}"`,
        activateCmd,
        pipUpgradeCmd,
        `${pipCmd} install -r requirements.txt`,
      ].join(" ; ");
      const [, stderr] = await runCommand(installRequirementsCommand);
      if (stderr) {
        throw new Error(stderr);
      }
    }
  });
}

function readEnvFile(path: string) {
  if (!fs.existsSync(path)) {
    return {};
  }
  let envFile = fs.readFileSync(path, "utf8");

  let env: { [key: string]: string } = {};
  envFile.split("\n").forEach((line) => {
    let [key, value] = line.split("=");
    if (typeof key === "undefined" || typeof value === "undefined") {
      return;
    }
    env[key] = value.replace(/"/g, "");
  });
  return env;
}

function writeEnvFile(path: string, key: string, value: string) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, `${key}="${value}"`);
    return;
  }

  let env = readEnvFile(path);
  env[key] = value;

  let newEnvFile = "";
  for (let key in env) {
    newEnvFile += `${key}="${env[key]}"\n`;
  }
  fs.writeFileSync(path, newEnvFile);
}

async function checkServerRunning(serverUrl: string): Promise<boolean> {
  // Check if already running by calling /health
  try {
    const response = await fetch(serverUrl + "/health");
    if (response.status === 200) {
      console.log("Continue python server already running");
      return true;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}

export async function startContinuePythonServer() {
  await setupPythonEnv();

  // Check vscode settings
  const serverUrl = getContinueServerUrl();
  if (serverUrl !== "http://localhost:65432") {
    return;
  }

  let activateCmd = ". env/bin/activate";
  let pythonCmd = "python3";
  if (process.platform == "win32") {
    activateCmd = ".\\env\\Scripts\\activate";
    pythonCmd = "python";
  }

  let command = `cd "${path.join(
    getExtensionUri().fsPath,
    "scripts"
  )}" && ${activateCmd} && cd .. && ${pythonCmd} -m scripts.run_continue_server`;

  return await retryThenFail(async () => {
    console.log("Starting Continue python server...");

    if (await checkServerRunning(serverUrl)) return;

    return new Promise(async (resolve, reject) => {
      try {
        const child = spawn(command, {
          shell: true,
        });
        child.stdout.on("data", (data: any) => {
          console.log(`stdout: ${data}`);
        });
        child.stderr.on("data", (data: any) => {
          if (
            data.includes("Uvicorn running on") || // Successfully started the server
            data.includes("address already in use") // The server is already running (probably a simultaneously opened VS Code window)
          ) {
            console.log("Successfully started Continue python server");
            resolve(null);
          } else {
            console.log(`stderr: ${data}`);
          }
        });
        child.on("error", (error: any) => {
          console.log(`error: ${error.message}`);
        });
      } catch (e) {
        console.log("Failed to start Continue python server", e);
        // If failed, check if it's because the server is already running (might have happened just after we checked above)
        if (await checkServerRunning(serverUrl)) {
          resolve(null);
        } else {
          reject();
        }
      }
    });
  });
}

async function installNodeModules() {
  console.log("Rebuilding node-pty for Continue extension...");
  await rebuild({
    buildPath: getExtensionUri().fsPath, // Folder containing node_modules
    electronVersion: "19.1.8",
    onlyModules: ["node-pty"],
  });
  console.log("Successfully rebuilt node-pty");
}

export function isPythonEnvSetup(): boolean {
  let pathToEnvCfg = getExtensionUri().fsPath + "/scripts/env/pyvenv.cfg";
  return fs.existsSync(path.join(pathToEnvCfg));
}

export async function downloadPython3() {
  // Download python3 and return the command to run it (python or python3)
  let os = process.platform;
  let command: string = "";
  let pythonCmd = "python3";
  if (os === "darwin") {
    throw new Error("python3 not found");
  } else if (os === "linux") {
    command =
      "sudo apt update ; upgrade ; sudo apt install python3 python3-pip";
  } else if (os === "win32") {
    command =
      "wget -O python_installer.exe https://www.python.org/ftp/python/3.11.3/python-3.11.3-amd64.exe ; python_installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0";
    pythonCmd = "python";
  }

  var [stdout, stderr] = await runCommand(command);
  if (stderr) {
    throw new Error(stderr);
  }
  console.log("Successfully downloaded python3");

  return pythonCmd;
}
