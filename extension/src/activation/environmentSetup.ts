import { getExtensionUri } from "../util/vscode";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { getContinueServerUrl } from "../bridge";
import fetch from "node-fetch";
import * as vscode from "vscode";
import * as os from "os";
import fkill from "fkill";
import { finished } from "stream/promises";
import request = require("request");

const exec = promisify(execCb);

async function runCommand(cmd: string): Promise<[string, string | undefined]> {
  var stdout = "";
  var stderr = "";
  try {
    var { stdout, stderr } = await exec(cmd, {
      shell: process.platform === "win32" ? "powershell.exe" : undefined,
    });
  } catch (e: any) {
    stderr = e.stderr;
    stdout = e.stdout;
  }

  const stderrOrUndefined = stderr === "" ? undefined : stderr;
  return [stdout, stderrOrUndefined];
}

async function checkServerRunning(serverUrl: string): Promise<boolean> {
  // Check if already running by calling /health
  try {
    const response = await fetch(`${serverUrl}/health`);
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

function serverBinaryPath(): string {
  return path.join(
    serverPath(),
    "exe",
    `run${os.platform() === "win32" ? ".exe" : ""}`
  );
}

export function getExtensionVersion() {
  const extension = vscode.extensions.getExtension("continue.continue");
  return extension?.packageJSON.version || "";
}

// Returns whether a server of the current version is already running
async function checkOrKillRunningServer(serverUrl: string): Promise<boolean> {
  const serverRunning = await checkServerRunning(serverUrl);
  let shouldKillAndReplace = true;

  if (fs.existsSync(serverVersionPath())) {
    const serverVersion = fs.readFileSync(serverVersionPath(), "utf8");
    if (serverVersion === getExtensionVersion() && serverRunning) {
      // The current version is already up and running, no need to continue
      console.log("Continue server of correct version already running");
      shouldKillAndReplace = false;
    }
  }

  // Kill the server if it is running an old version
  if (shouldKillAndReplace) {
    console.log("Killing server from old version of Continue");
    try {
      await fkill(":65432", { force: true });
    } catch (e: any) {
      if (!e.message.includes("Process doesn't exist")) {
        console.log("Failed to kill old server:", e);

        // Try again, on Windows. This time with taskkill
        if (os.platform() === "win32") {
          try {
            await runCommand(`taskkill /F /IM run.exe`);
          } catch (e: any) {
            console.log(
              "Failed to kill old server second time on windows with taskkill:",
              e
            );
          }
        }
      }
    }
    if (fs.existsSync(serverVersionPath())) {
      fs.unlinkSync(serverVersionPath());
    }
    // Also delete the server binary
    const serverBinary = serverBinaryPath();
    if (fs.existsSync(serverBinary)) {
      fs.unlinkSync(serverBinary);
    }
  }

  return serverRunning && !shouldKillAndReplace;
}

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

export async function downloadFromS3(
  bucket: string,
  fileName: string,
  destination: string,
  region: string
) {
  try {
    ensureDirectoryExistence(destination);
    const file = fs.createWriteStream(destination);
    const download = request({
      url: `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`,
    });

    download.on("response", (response: any) => {
      if (response.statusCode !== 200) {
        throw new Error("No body returned when downloading from S3 bucket");
      }
    });

    download.on("error", (err: any) => {
      if (fs.existsSync(destination)) {
        fs.unlink(destination, () => {});
      }
      throw err;
    });

    download.pipe(file);

    await finished(download);
  } catch (err: any) {
    const errText = `Failed to download Continue server from S3: ${err.message}`;
    vscode.window.showErrorMessage(errText);
  }
}

export async function startContinuePythonServer(redownload: boolean = true) {
  // Check vscode settings
  const manuallyRunningServer =
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("manuallyRunningServer") || false;
  const serverUrl = getContinueServerUrl();
  if (serverUrl !== "http://localhost:65432" || manuallyRunningServer) {
    console.log("Continue server is being run manually, skipping start");
    return;
  }

  // Check if server is already running
  if (redownload && (await checkOrKillRunningServer(serverUrl))) {
    console.log("Continue server already running");
    return;
  }

  // Download the server executable
  const bucket = "continue-server-binaries";
  const fileName =
    os.platform() === "win32"
      ? "windows/run.exe"
      : os.platform() === "darwin"
      ? os.arch() === "arm64"
        ? "apple-silicon/run"
        : "mac/run"
      : "linux/run";

  const destination = serverBinaryPath();

  // First, check if the server is already downloaded
  let shouldDownload = true;
  if (fs.existsSync(destination) && redownload) {
    // Check if the server is the correct version
    if (fs.existsSync(serverVersionPath())) {
      const serverVersion = fs.readFileSync(serverVersionPath(), "utf8");
      if (serverVersion === getExtensionVersion()) {
        // The current version is already up and running, no need to continue
        console.log("Continue server already downloaded");
        shouldDownload = false;
      } else {
        console.log("Old version of the server downloaded");
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
      }
    } else {
      console.log("Old version of the server downloaded");
      if (fs.existsSync(destination)) {
        fs.unlinkSync(destination);
      }
    }
  }

  if (shouldDownload && redownload) {
    let timeout = setTimeout(() => {
      vscode.window.showErrorMessage(
        `It looks like the Continue server is taking a while to download. If this persists, you can manually download the binary or run it from source: https://continue.dev/docs/troubleshooting#run-the-server-manually.`
      );
    }, 20_000);

    let download = vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Installing Continue server...",
        cancellable: false,
      },
      async () => {
        await downloadFromS3(bucket, fileName, destination, "us-west-1");
      }
    );
    try {
      await download;
      console.log("Downloaded server executable at ", destination);
      clearTimeout(timeout);
    } catch (e) {
      console.log("Failed to download server executable", e);
    }
  }

  // Get name of the corresponding executable for platform
  if (os.platform() === "darwin") {
    // Add necessary permissions
    fs.chmodSync(destination, 0o7_5_5);
    await runCommand(`xattr -dr com.apple.quarantine ${destination}`);
  } else if (os.platform() === "linux") {
    // Add necessary permissions
    fs.chmodSync(destination, 0o7_5_5);
  }

  // Validate that the file exists
  console.log("Looking for file at ", destination);
  if (!fs.existsSync(destination)) {
    // List the contents of the folder
    const files = fs.readdirSync(
      path.join(getExtensionUri().fsPath, "server", "exe")
    );
    console.log("Files in server folder: ", files);
    const errText = `- Failed to install Continue server.`;
    vscode.window.showErrorMessage(errText);
    console.log("6: throwing error message: ", errText);
    throw new Error(errText);
  }

  // Run the executable
  console.log("---- Starting Continue server ----");
  let attempts = 0;
  let maxAttempts = 5;
  let delay = 1000; // Delay between each attempt in milliseconds

  const spawnChild = () => {
    const retry = (e: any) => {
      attempts++;
      console.log(`Error caught: ${e}.\n\nRetrying attempt ${attempts}...`);
      setTimeout(spawnChild, delay);
    };
    try {
      // NodeJS bug requires not using detached on Windows, otherwise windowsHide is ineffective
      // Otherwise, detach is preferable
      const windowsSettings = {
        windowsHide: true,
      };
      const macLinuxSettings = {
        detached: true,
        stdio: "ignore",
      };
      const settings: any =
        os.platform() === "win32" ? windowsSettings : macLinuxSettings;
      // Spawn the server
      const child = spawn(destination, settings);

      // Either unref to avoid zombie process, or listen to events because you can
      if (os.platform() === "win32") {
        child.stdout.on("data", (data: any) => {
          console.log(`stdout: ${data}`);
        });
        child.stderr.on("data", (data: any) => {
          console.log(`stderr: ${data}`);
        });
        child.on("error", (err: any) => {
          if (attempts < maxAttempts) {
            retry(err);
          } else {
            console.error("Failed to start subprocess.", err);
          }
        });
        child.on("exit", (code: any, signal: any) => {
          console.log("Subprocess exited with code", code, signal);
        });
        child.on("close", (code: any, signal: any) => {
          console.log("Subprocess closed with code", code, signal);
        });
      } else {
        child.unref();
      }
    } catch (e: any) {
      if (attempts < maxAttempts) {
        retry(e);
      } else {
        throw e;
      }
    }
  };

  spawnChild();

  // Write the current version of vscode extension to a file called server_version.txt
  fs.writeFileSync(serverVersionPath(), getExtensionVersion());
}
