import { getExtensionUri } from "../util/vscode";
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const { spawn } = require("child_process");
import * as path from "path";
import * as fs from "fs";
import { getContinueServerUrl } from "../bridge";
import fetch from "node-fetch";
import * as vscode from "vscode";
import * as os from "os";
import fkill from "fkill";

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

export async function getPythonPipCommands() {
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
      throw new Error("Python 3 is not installed.");
    }
  }

  let pipCmd = pythonCmd.endsWith("3") ? "pip3" : "pip";

  const version = stdout.split(" ")[1];
  const [major, minor] = version.split(".");
  if (parseInt(major) !== 3 || parseInt(minor) < 8) {
    // Need to check specific versions
    const checkPython3VersionExists = async (minorVersion: number) => {
      const [stdout, stderr] = await runCommand(
        `python3.${minorVersion} --version`
      );
      return typeof stderr === "undefined" || stderr === "";
    };

    const VALID_VERSIONS = [8, 9, 10, 11, 12];
    let versionExists = false;

    for (const minorVersion of VALID_VERSIONS) {
      if (await checkPython3VersionExists(minorVersion)) {
        versionExists = true;
        pythonCmd = `python3.${minorVersion}`;
        pipCmd = `pip3.${minorVersion}`;
      }
    }

    if (!versionExists) {
      vscode.window.showErrorMessage(
        "Continue requires Python version 3.8 or greater. Please update your Python installation, reload VS Code, and try again."
      );
      throw new Error("Python3.8 or greater is not installed.");
    }
  }

  return [pythonCmd, pipCmd];
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

export function getContinueGlobalPath(): string {
  // This is ~/.continue on mac/linux
  const continuePath = path.join(os.homedir(), ".continue");
  if (!fs.existsSync(continuePath)) {
    fs.mkdirSync(continuePath);
  }
  return continuePath;
}

function serverPath(): string {
  const sPath = path.join(getContinueGlobalPath(), "server");
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

export function devDataPath(): string {
  const sPath = path.join(getContinueGlobalPath(), "dev_data");
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

function serverVersionPath(): string {
  return path.join(serverPath(), "server_version.txt");
}

export function getExtensionVersion() {
  const extension = vscode.extensions.getExtension("continue.continue");
  return extension?.packageJSON.version || "";
}

// Returns whether a server of the current version is already running
async function checkOrKillRunningServer(serverUrl: string): Promise<boolean> {
  console.log("Checking if server is old version");
  // Kill the server if it is running an old version
  if (fs.existsSync(serverVersionPath())) {
    const serverVersion = fs.readFileSync(serverVersionPath(), "utf8");
    if (
      serverVersion === getExtensionVersion() &&
      (await checkServerRunning(serverUrl))
    ) {
      // The current version is already up and running, no need to continue
      return true;
    }
  }
  console.log("Killing old server...");
  try {
    await fkill(":65432");
  } catch (e: any) {
    if (!e.message.includes("Process doesn't exist")) {
      console.log("Failed to kill old server:", e);
    }
  }
  return false;
}

export async function startContinuePythonServer() {
  // Check vscode settings
  const serverUrl = getContinueServerUrl();
  if (serverUrl !== "http://localhost:65432") {
    return;
  }

  // Check if server is already running
  if (await checkOrKillRunningServer(serverUrl)) {
    return;
  }

  // Get name of the corresponding executable for platform
  const exeDir = path.join(getExtensionUri().fsPath, "server", "exe");
  let exePath: string;
  if (os.platform() === "win32") {
    exePath = path.join(exeDir, "windows", "run.exe");
  } else if (os.platform() === "darwin") {
    exePath = path.join(exeDir, "mac", "run");
    // Add permissions
    await runCommand(`chmod +x ${exePath}`);
    await runCommand(`xattr -dr com.apple.quarantine ${exePath}`);
  } else {
    exePath = path.join(exeDir, "linux", "run");
  }

  // Run the executable
  const child = spawn(exePath, {
    shell: true,
  });
  child.stderr.on("data", (data: any) => {
    console.log(data.toString());
  });

  child.on("error", (error: any) => {
    console.log(`error: ${error.message}`);
  });

  child.on("close", (code: any) => {
    console.log(`child process exited with code ${code}`);
  });

  child.stdout.on("data", (data: any) => {
    console.log(`stdout: ${data.toString()}`);
  });

  // Write the current version of vscode extension to a file called server_version.txt
  fs.writeFileSync(serverVersionPath(), getExtensionVersion());
}
