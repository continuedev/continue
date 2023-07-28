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

const WINDOWS_REMOTE_SIGNED_SCRIPTS_ERROR =
  "A Python virtual enviroment cannot be activated because running scripts is disabled for this user. In order to use Continue, please enable signed scripts to run with this command in PowerShell: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, reload VS Code, and then try again.";

const MAX_RETRIES = 3;
async function retryThenFail(
  fn: () => Promise<any>,
  retries: number = MAX_RETRIES
): Promise<any> {
  try {
    if (retries < MAX_RETRIES && process.platform === "win32") {
      let [stdout, stderr] = await runCommand("Get-ExecutionPolicy");
      if (!stdout.includes("RemoteSigned")) {
        [stdout, stderr] = await runCommand(
          "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
        );
        console.log("Execution policy stdout: ", stdout);
        console.log("Execution policy stderr: ", stderr);
      }
    }

    return await fn();
  } catch (e: any) {
    if (retries > 0) {
      return await retryThenFail(fn, retries - 1);
    }

    // Show corresponding error message depending on the platform
    let msg =
      "Failed to set up Continue extension. Please email hi@continue.dev and we'll get this fixed ASAP!";
    try {
      switch (process.platform) {
        case "win32":
          msg = WINDOWS_REMOTE_SIGNED_SCRIPTS_ERROR;
          break;
        case "darwin":
          break;
        case "linux":
          const [pythonCmd] = await getPythonPipCommands();
          msg = await getLinuxAptInstallError(pythonCmd);
          break;
      }
    } finally {
      console.log("After retries, failed to set up Continue extension", msg);
      vscode.window
        .showErrorMessage(msg, "View Logs", "Retry")
        .then((selection) => {
          if (selection === "View Logs") {
            vscode.commands.executeCommand("continue.viewLogs");
          } else if (selection === "Retry") {
            // Reload VS Code window
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    }

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

function getActivateUpgradeCommands(pythonCmd: string, pipCmd: string) {
  let activateCmd = ". env/bin/activate";
  let pipUpgradeCmd = `${pipCmd} install --upgrade pip`;
  if (process.platform == "win32") {
    activateCmd = ".\\env\\Scripts\\activate";
    pipUpgradeCmd = `${pythonCmd} -m pip install --upgrade pip`;
  }
  return [activateCmd, pipUpgradeCmd];
}

function checkEnvExists() {
  const envBinPath = path.join(
    serverPath(),
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

async function checkRequirementsInstalled() {
  // First, check if the requirements have been installed most recently for a later version of the extension
  if (fs.existsSync(requirementsVersionPath())) {
    const requirementsVersion = fs.readFileSync(
      requirementsVersionPath(),
      "utf8"
    );
    if (requirementsVersion !== getExtensionVersion()) {
      // Remove the old version of continuedev from site-packages
      const [pythonCmd, pipCmd] = await getPythonPipCommands();
      const [activateCmd] = getActivateUpgradeCommands(pythonCmd, pipCmd);
      const removeOldVersionCommand = [
        `cd "${serverPath()}"`,
        activateCmd,
        `${pipCmd} uninstall -y continuedev`,
      ].join(" ; ");
      await runCommand(removeOldVersionCommand);
      return false;
    }
  }

  let envLibsPath = path.join(
    serverPath(),
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
}

async function getLinuxAptInstallError(pythonCmd: string) {
  // First, try to run the command to install python3-venv
  let [stdout, stderr] = await runCommand(`${pythonCmd} --version`);
  if (stderr) {
    await vscode.window.showErrorMessage(
      "Python3 is not installed. Please install from https://www.python.org/downloads, reload VS Code, and try again."
    );
    throw new Error(stderr);
  }
  const version = stdout.split(" ")[1].split(".")[1];
  const installVenvCommand = `apt-get install python3.${version}-venv`;
  await runCommand("apt-get update");
  return `[Important] Continue needs to create a Python virtual environment, but python3.${version}-venv is not installed. Please run this command in your terminal: \`${installVenvCommand}\`, reload VS Code, and then try again.`;
}

async function createPythonVenv(pythonCmd: string) {
  if (checkEnvExists()) {
    console.log("Python env already exists, skipping...");
  } else {
    // Assemble the command to create the env
    const createEnvCommand = [
      `cd "${serverPath()}"`,
      `${pythonCmd} -m venv env`,
    ].join(" ; ");

    const [stdout, stderr] = await runCommand(createEnvCommand);
    if (
      stderr &&
      stderr.includes("running scripts is disabled on this system")
    ) {
      console.log("Scripts disabled error when trying to create env");
      await vscode.window.showErrorMessage(WINDOWS_REMOTE_SIGNED_SCRIPTS_ERROR);
      throw new Error(stderr);
    } else if (
      stderr?.includes("On Debian/Ubuntu systems") ||
      stdout?.includes("On Debian/Ubuntu systems")
    ) {
      const msg = await getLinuxAptInstallError(pythonCmd);
      console.log(msg);
      await vscode.window.showErrorMessage(msg);
    } else if (checkEnvExists()) {
      console.log("Successfully set up python env at ", `${serverPath()}/env`);
    } else if (
      stderr?.includes("Permission denied") &&
      stderr?.includes("python.exe")
    ) {
      // This might mean that another window is currently using the python.exe file to install requirements
      // So we want to wait and try again
      let i = 0;
      await new Promise((resolve, reject) =>
        setInterval(() => {
          if (i > 5) {
            reject("Timed out waiting for other window to create env...");
          }
          if (checkEnvExists()) {
            resolve(null);
          } else {
            console.log("Waiting for other window to create env...");
          }
          i++;
        }, 5000)
      );
    } else {
      const msg = [
        "Python environment not successfully created. Trying again. Here was the stdout + stderr: ",
        `stdout: ${stdout}`,
        `stderr: ${stderr}`,
      ].join("\n\n");
      console.log(msg);
      throw new Error(msg);
    }
  }
}

async function setupPythonEnv() {
  console.log("Setting up python env for Continue extension...");

  const [pythonCmd, pipCmd] = await getPythonPipCommands();
  const [activateCmd, pipUpgradeCmd] = getActivateUpgradeCommands(
    pythonCmd,
    pipCmd
  );

  await retryThenFail(async () => {
    // First, create the virtual environment
    await createPythonVenv(pythonCmd);

    // Install the requirements
    if (await checkRequirementsInstalled()) {
      console.log("Python requirements already installed, skipping...");
    } else {
      const installRequirementsCommand = [
        `cd "${serverPath()}"`,
        activateCmd,
        pipUpgradeCmd,
        `${pipCmd} install -r requirements.txt`,
      ].join(" ; ");
      const [, stderr] = await runCommand(installRequirementsCommand);
      if (stderr) {
        throw new Error(stderr);
      }
      // Write the version number for which requirements were installed
      fs.writeFileSync(requirementsVersionPath(), getExtensionVersion());
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

export function getContinueGlobalPath(): string {
  // This is ~/.continue on mac/linux
  const continuePath = path.join(os.homedir(), ".continue");
  if (!fs.existsSync(continuePath)) {
    fs.mkdirSync(continuePath);
  }
  return continuePath;
}

function setupServerPath() {
  const sPath = serverPath();
  const extensionServerPath = path.join(getExtensionUri().fsPath, "server");
  const files = fs.readdirSync(extensionServerPath);
  files.forEach((file) => {
    const filePath = path.join(extensionServerPath, file);
    fs.copyFileSync(filePath, path.join(sPath, file));
  });
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

function requirementsVersionPath(): string {
  return path.join(serverPath(), "requirements_version.txt");
}

export function getExtensionVersion() {
  const extension = vscode.extensions.getExtension("continue.continue");
  return extension?.packageJSON.version || "";
}

export async function startContinuePythonServer() {
  // Check vscode settings
  const serverUrl = getContinueServerUrl();
  if (serverUrl !== "http://localhost:65432") {
    return;
  }

  setupServerPath();

  return await retryThenFail(async () => {
    console.log("Checking if server is old version");
    // Kill the server if it is running an old version
    if (fs.existsSync(serverVersionPath())) {
      const serverVersion = fs.readFileSync(serverVersionPath(), "utf8");
      if (
        serverVersion === getExtensionVersion() &&
        (await checkServerRunning(serverUrl))
      ) {
        // The current version is already up and running, no need to continue
        return;
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

    // Do this after above check so we don't have to waste time setting up the env
    await setupPythonEnv();

    // Spawn the server process on port 65432
    const [pythonCmd] = await getPythonPipCommands();
    const activateCmd =
      process.platform == "win32"
        ? ".\\env\\Scripts\\activate"
        : ". env/bin/activate";

    const command = `cd "${serverPath()}" && ${activateCmd} && cd .. && ${pythonCmd} -m server.run_continue_server`;

    console.log("Starting Continue python server...");

    return new Promise(async (resolve, reject) => {
      try {
        const child = spawn(command, {
          shell: true,
        });
        child.stderr.on("data", (data: any) => {
          console.log(`stdout: ${data}`);
          if (
            data.includes("Uvicorn running on") || // Successfully started the server
            data.includes("only one usage of each socket address") || // [windows] The server is already running (probably a simultaneously opened VS Code window)
            data.includes("address already in use") // [mac/linux] The server is already running (probably a simultaneously opened VS Code window)
          ) {
            console.log("Successfully started Continue python server");
            resolve(null);
          } else if (data.includes("ERROR") || data.includes("Traceback")) {
            console.log("Error starting Continue python server: ", data);
          }
        });
        child.on("error", (error: any) => {
          console.log(`error: ${error.message}`);
        });

        child.on("close", (code: any) => {
          console.log(`child process exited with code ${code}`);
        });

        child.stdout.on("data", (data: any) => {
          console.log(`stdout: ${data}`);
        });

        // Write the current version of vscode to a file called server_version.txt
        fs.writeFileSync(serverVersionPath(), getExtensionVersion());
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

export function isPythonEnvSetup(): boolean {
  const pathToEnvCfg = path.join(serverPath(), "env", "pyvenv.cfg");
  return fs.existsSync(pathToEnvCfg);
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
