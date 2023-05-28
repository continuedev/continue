import { getExtensionUri } from "../util/vscode";
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const { spawn } = require("child_process");
import * as path from "path";
import * as fs from "fs";
import rebuild from "@electron/rebuild";
import * as vscode from "vscode";
import { getContinueServerUrl } from "../bridge";
import fetch from "node-fetch";

async function runCommand(cmd: string): Promise<[string, string | undefined]> {
  var stdout: any = "";
  var stderr: any = "";
  try {
    var { stdout, stderr } = await exec(cmd);
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

async function getPythonCmdAssumingInstalled() {
  const [, stderr] = await runCommand("python3 --version");
  if (stderr) {
    return "python";
  }
  return "python3";
}

async function setupPythonEnv() {
  console.log("Setting up python env for Continue extension...");
  // First check that python3 is installed

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
      console.log("Python3 not found, downloading...");
      await downloadPython3();
    }
  }
  let pipCmd = pythonCmd.endsWith("3") ? "pip3" : "pip";

  let activateCmd = ". env/bin/activate";
  let pipUpgradeCmd = `${pipCmd} install --upgrade pip`;
  if (process.platform == "win32") {
    activateCmd = ".\\env\\Scripts\\activate";
    pipUpgradeCmd = `${pythonCmd} -m pip install --upgrade pip`;
  }

  let command = `cd ${path.join(
    getExtensionUri().fsPath,
    "scripts"
  )} && ${pythonCmd} -m venv env && ${activateCmd} && ${pipUpgradeCmd} && ${pipCmd} install -r requirements.txt`;
  var [stdout, stderr] = await runCommand(command);
  if (stderr) {
    throw new Error(stderr);
  }
  console.log(
    "Successfully set up python env at ",
    getExtensionUri().fsPath + "/scripts/env"
  );

  await startContinuePythonServer();
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

export async function startContinuePythonServer() {
  // Check vscode settings
  let serverUrl = getContinueServerUrl();
  if (serverUrl !== "http://localhost:8000") {
    return;
  }

  let envFile = path.join(getExtensionUri().fsPath, "scripts", ".env");
  let openai_api_key: string | undefined =
    readEnvFile(envFile)["OPENAI_API_KEY"];
  while (typeof openai_api_key === "undefined" || openai_api_key === "") {
    openai_api_key = await vscode.window.showInputBox({
      prompt: "Enter your OpenAI API key",
      placeHolder: "Enter your OpenAI API key",
    });
    // Write to .env file
  }
  writeEnvFile(envFile, "OPENAI_API_KEY", openai_api_key);

  console.log("Starting Continue python server...");

  // Check if already running by calling /health
  try {
    let response = await fetch(serverUrl + "/health");
    if (response.status === 200) {
      console.log("Continue python server already running");
      return;
    }
  } catch (e) {}

  let activateCmd = ". env/bin/activate";
  let pythonCmd = "python3";
  if (process.platform == "win32") {
    activateCmd = ".\\env\\Scripts\\activate";
    pythonCmd = "python";
  }

  let command = `cd ${path.join(
    getExtensionUri().fsPath,
    "scripts"
  )} && ${activateCmd} && cd .. && ${pythonCmd} -m scripts.run_continue_server`;
  try {
    // exec(command);
    let child = spawn(command, {
      shell: true,
      detached: true,
    });
    child.stdout.on("data", (data: any) => {
      console.log(`stdout: ${data}`);
    });
    child.stderr.on("data", (data: any) => {
      console.log(`stderr: ${data}`);
    });
    child.on("error", (error: any) => {
      console.log(`error: ${error.message}`);
    });
  } catch (e) {
    console.log("Failed to start Continue python server", e);
  }
  // Sleep for 3 seconds to give the server time to start
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log("Successfully started Continue python server");
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

export async function setupExtensionEnvironment() {
  console.log("Setting up environment for Continue extension...");
  await Promise.all([setupPythonEnv()]);
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
      "sudo apt update && upgrade && sudo apt install python3 python3-pip";
  } else if (os === "win32") {
    command =
      "wget -O python_installer.exe https://www.python.org/ftp/python/3.11.3/python-3.11.3-amd64.exe && python_installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0";
    pythonCmd = "python";
  }

  var [stdout, stderr] = await runCommand(command);
  if (stderr) {
    throw new Error(stderr);
  }
  console.log("Successfully downloaded python3");

  return pythonCmd;
}
