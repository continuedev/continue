import * as vscode from "vscode";
import * as cp from "child_process";
import { Core } from "core/core";
import { ContinueGUIWebviewViewProvider } from "../../ContinueGUIWebviewViewProvider";
import { getIntegrationTab } from "../../util/integrationUtils";
import Aider from "core/llm/llms/Aider";
import { execSync } from "child_process";
import { isFirstPearAICreatorLaunch } from "../../copySettings";

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === "win32";
const IS_MAC = PLATFORM === "darwin";
const IS_LINUX = PLATFORM === "linux";

let aiderPanel: vscode.WebviewPanel | undefined;

// Aider process management functions
export async function startAiderProcess(
  core: Core,
) {
  const isBrewInstalled = IS_MAC || IS_LINUX ? await checkBrewInstallation() : true;
  const isPythonInstalled = await checkPythonInstallation();
  const isAiderInstalled = await checkAiderInstallation();
  // If this is the first time running, try to install aider automatically if we can
  if (isFirstPearAICreatorLaunch) {
    if (!isAiderInstalled) {
      // If aider is not installed and prereq's are not installed, then go to manual installation
      if (!isBrewInstalled || !isPythonInstalled) {
        return
      } else { // If prereq's are installed, then try to install aider automatically
        await handleAiderNotInstalled(core);
        return
      }
    }
  } else {
    // If this is not the first time we are running and aider is not installed, give up.
    // Users will have to manual install
    if (!isAiderInstalled) {
      return
    }
  }

  const config = await core.configHandler.loadConfig();
  const aiderModel = config.models.find((model) => model instanceof Aider) as
    | Aider
    | undefined;

  if (aiderModel) {
    try {
      await aiderModel.startAiderChat(aiderModel.model, aiderModel.apiKey);
    } catch (e) {
      console.warn(`Error starting Aider process: ${e}`);
    }
  } else {
    console.warn("No Aider model found in configuration");
  }
}

export async function refreshAiderProcessStatus(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModel = config.models.find((model) => model instanceof Aider) as Aider | undefined;

  if (!aiderModel) {
    core.send("aiderProcessStateUpdate", { status: "stopped" });
    return;
  }

  if (aiderModel.isAiderUp) {
    core.send("aiderProcessStateUpdate", { status: "ready" });
    return;
  }

  if (aiderModel.isAiderStarted) {
    core.send("aiderProcessStateUpdate", { status: "starting" });
  }

  if (aiderModel.isAiderStopped) {
    core.send("aiderProcessStateUpdate", { status: "stopped" });
  }

  // Else, means there was a problem with installation
  core.send("aiderProcessStateUpdate", { status: "uninstalled" });
}

export async function killAiderProcess(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(
    (model) => model instanceof Aider,
  ) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach((model) => {
        model.killAiderProcess();
        model.isAiderStopped = true
      });
    }
  } catch (e) {
    console.warn(`Error killing Aider process: ${e}`);
  }
}

export async function aiderCtrlC(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(
    (model) => model instanceof Aider,
  ) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach((model) => {
        if (model.aiderProcess) {
          model.aiderCtrlC();
        }
      });
      // This is when we cancelled an ongoing request
    }
  } catch (e) {
    console.warn(`Error sending Ctrl-C to Aider process: ${e}`);
  }
}

export async function aiderResetSession(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(
    (model) => model instanceof Aider,
  ) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach((model) => {
        if (model.aiderProcess) {
          model.aiderResetSession(model.model, model.apiKey);
        }
      });
    }
  } catch (e) {
    console.warn(`Error resetting Aider session: ${e}`);
  }
}

export async function openAiderPanel(
  core: Core,
  sidebar: ContinueGUIWebviewViewProvider,
  extensionContext: vscode.ExtensionContext,
) {
  // Check if aider is already open by checking open tabs
  const aiderTab = getIntegrationTab("pearai.aiderGUIView");
  console.log("Aider tab found:", aiderTab);
  console.log("Aider tab active:", aiderTab?.isActive);
  console.log("Aider panel exists:", !!aiderPanel);

  // Check if the active editor is the Continue GUI View
  if (aiderTab && aiderTab.isActive) {
    vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
    return;
  }

  if (aiderTab && aiderPanel) {
    //aider open, but not focused - focus it
    aiderPanel.reveal();
    return;
  }

  //create the full screen panel
  let panel = vscode.window.createWebviewPanel(
    "pearai.aiderGUIView",
    "PearAI Creator (Powered by aider)",
    vscode.ViewColumn.One,
    {
      retainContextWhenHidden: true,
    },
  );
  aiderPanel = panel;

  //Add content to the panel
  panel.webview.html = sidebar.getSidebarContent(
    extensionContext,
    panel,
    undefined,
    undefined,
    true,
    "/aiderMode",
  );

  sidebar.webviewProtocol?.request(
    "focusContinueInputWithNewSession",
    undefined,
    ["pearai.aiderGUIView"],
  );

  //When panel closes, reset the webview and focus
  panel.onDidDispose(
    () => {
      // Kill background process
      core.invoke("llm/killAiderProcess", undefined);

      // The following order is important as it does not reset the history in chat when closing creator
      vscode.commands.executeCommand("pearai.focusContinueInput");
      sidebar.resetWebviewProtocolWebview();
    },
    null,
    extensionContext.subscriptions,
  );
}



async function checkPythonInstallation(): Promise<boolean> {
  const commands = ["python3 --version", "python --version"];

  for (const command of commands) {
    try {
      await executeCommand(command);
      return true;
    } catch (error) {
      console.warn(`${command} failed: ${error}`);
    }
  }

  console.warn("Python 3 is not installed or not accessible on this system.");
  return false;
}

async function checkAiderInstallation(): Promise<boolean> {
  const commands = [
    "aider --version",
    "python -m aider --version",
    "python3 -m aider --version",
  ];

  for (const cmd of commands) {
    try {
      await executeCommand(cmd);
      return true;
    } catch (error) {
      console.warn(`Failed to execute ${cmd}: ${error}`);
    }
  }
  return false;
}

async function checkBrewInstallation(): Promise<boolean> {
  try {
    await executeCommand("brew --version");
    return true;
  } catch (error) {
    console.warn(`Brew is not installed: ${error}`);
    return false;
  }
}

async function handleAiderNotInstalled(core: Core) {
  const isPythonInstalled = await checkPythonInstallation();
  console.log("PYTHON CHECK RESULT :");
  console.dir(isPythonInstalled);
  const isBrewInstalled = IS_MAC || IS_LINUX ? await checkBrewInstallation() : true;
  console.log("BREW CHECK RESULT :");
  console.dir(isBrewInstalled);
  const isAiderInstalled = await checkAiderInstallation();
  console.log("AIDER CHECK RESULT :");
  console.dir(isAiderInstalled);
  if (isAiderInstalled) {
    return;
  }

  if (!isAiderInstalled) {
    let command = "";
    if (IS_WINDOWS) {
      command += "python -m pip install -U aider-chat;";
      command += 'echo "`nAider installation complete."';
    } else {
      command += "brew install aider;";
      command += "echo '\nAider installation complete.'";
    }

    try {
        execSync(command);
        // If execution was successful, start the Aider process
        core.invoke("llm/startAiderProcess", undefined);
    } catch (error) {
        // Handle the error case
        console.error("Failed to execute Aider command:", error);
    }
  }
}

async function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function getPythonInstallCommand(): string {
  switch (PLATFORM) {
    case "win32":
      return "winget install Python.Python.3.9";
    case "darwin":
      return "brew install python@3";
    default: // Linux
      return "sudo apt-get install -y python3";
  }
}

// Commented out as the user must do this themselves

// async function isPythonInPath(): Promise<boolean> {
//   try {
//     return checkPythonInstallation();
//   } catch (error) {
//     console.warn(`Error checking Python in PATH: ${error}`);
//     return false;
//   }
// }

// async function setupPythonEnvironmentVariables(): Promise<void> {
//   const pythonAlreadyInPath = await isPythonInPath();
//   if (pythonAlreadyInPath) {
//     console.log("Python is already in PATH, skipping environment setup");
//     return;
//   }

//   vscode.window.showInformationMessage(
//     "Adding Python to PATH. Please restart PearAI after Python is added to PATH successfully.",
//   );
//   const terminal = vscode.window.createTerminal("Python PATH Setup");
//   terminal.show();

//   switch (PLATFORM) {
//     case "win32":
//       terminal.sendText(`
// # PowerShell Script to Add Specific Python Paths to User PATH Variable at the Top

// # Get the current username
// $username = [System.Environment]::UserName

// # Define Python paths with the current username
// $pythonPath = "C:\\Users\\$username\\AppData\\Local\\Programs\\Python\\Python39"
// $pythonScriptsPath = "C:\\Users\\$username\\AppData\\Local\\Programs\\Python\\Python39\\Scripts"

// # Retrieve the current user PATH
// $currentUserPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

// # Add the new paths at the top if they're not already present
// if ($currentUserPath -notlike "*$pythonPath*") {
//     # Prepend the Python paths to the existing user PATH
//     $newUserPath = "$pythonPath;$pythonScriptsPath;$currentUserPath"
//     [System.Environment]::SetEnvironmentVariable("Path", $newUserPath, [System.EnvironmentVariableTarget]::User)
//     Write-Output "Python paths have been added to user PATH."
// } else {
//     Write-Output "Python paths are already in the user PATH. "
//     Write-Output "Try Running PearAI Creator (Aider) Again."
// }
//         `);
//       break;

//     case "darwin":
//       terminal.sendText(`
//           PYTHON_PATH=$(which python3)
//           if [ -n "$PYTHON_PATH" ]; then
//             PYTHON_DIR=$(dirname "$PYTHON_PATH")
//             if ! grep -q "export PATH=.*$PYTHON_DIR" ~/.zshrc; then
//               echo "\\nexport PATH=\\"$PYTHON_DIR:\$PATH\\"" >> ~/.zshrc
//               echo "Python path added to .zshrc"
//               source ~/.zshrc
//             fi
//           fi
//         `);
//       break;

//     case "linux":
//       terminal.sendText(`
//           PYTHON_PATH=$(which python3)
//           if [ -n "$PYTHON_PATH" ]; then
//             PYTHON_DIR=$(dirname "$PYTHON_PATH")
//             if ! grep -q "export PATH=.*$PYTHON_DIR" ~/.bashrc; then
//               echo "\\nexport PATH=\\"$PYTHON_DIR:\$PATH\\"" >> ~/.bashrc
//               echo "Python path added to .bashrc"
//               source ~/.bashrc
//             fi
//           fi
//         `);
//       break;
//   }
// }
