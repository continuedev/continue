import * as vscode from "vscode";
import * as cp from "child_process";
import { Core } from "core/core";
import { ContinueGUIWebviewViewProvider } from "../../ContinueGUIWebviewViewProvider";
import { getIntegrationTab } from "../../util/integrationUtils";
import Aider from "core/llm/llms/aider";

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === "win32";
const IS_MAC = PLATFORM === "darwin";
const IS_LINUX = PLATFORM === "linux";

let aiderPanel: vscode.WebviewPanel | undefined;

// Aider process management functions
export async function startAiderProcess(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModel = config.models.find(model => model instanceof Aider) as Aider | undefined;

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

export async function killAiderProcess(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(model => model instanceof Aider) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach(model => {
        model.killAiderProcess();
      });
    }
  } catch (e) {
    console.warn(`Error killing Aider process: ${e}`);
  }
}

export async function aiderCtrlC(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(model => model instanceof Aider) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach(model => {
        if (model.aiderProcess) {
          model.aiderCtrlC();
        }
      });
    }
  } catch (e) {
    console.warn(`Error sending Ctrl-C to Aider process: ${e}`);
  }
}

export async function aiderResetSession(core: Core) {
  const config = await core.configHandler.loadConfig();
  const aiderModels = config.models.filter(model => model instanceof Aider) as Aider[];

  try {
    if (aiderModels.length > 0) {
      aiderModels.forEach(model => {
        if (model.aiderProcess) {
          model.aiderResetSession(model.model, model.apiKey);
        }
      });
    }
  } catch (e) {
    console.warn(`Error resetting Aider session: ${e}`);
  }
}

export async function handleAiderMode(
  core: Core,
  sidebar: ContinueGUIWebviewViewProvider,
  extensionContext: vscode.ExtensionContext,
) {
  await installPythonAider();
  // Check if aider is already open by checking open tabs
  const aiderTab = getIntegrationTab("pearai.aiderGUIView");
  core.invoke("llm/startAiderProcess", undefined);
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

  sidebar.webviewProtocol?.request("focusContinueInputWithNewSession", undefined, ["pearai.aiderGUIView"]);

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
    "python3 -m aider --version"
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

async function installPythonAider() {
  const isPythonInstalled = await checkPythonInstallation();
  console.log("PYTHON CHECK RESULT :");
  console.dir(isPythonInstalled);
  const isAiderInstalled = await checkAiderInstallation();
  console.log("AIDER CHECK RESULT :");
  console.dir(isAiderInstalled);

  if (isPythonInstalled && isAiderInstalled) {
    return;
  }

  if (!isPythonInstalled) {
    const installPythonConfirm = await vscode.window.showInformationMessage(
      "Python is required to run Creator (Aider). Choose 'Install' to install Python3.9",
      "Install",
      "Cancel",
      "Manual Installation Guide",
    );

    if (installPythonConfirm === "Cancel") {
      return;
    } else if (installPythonConfirm === "Manual Installation Guide") {
      vscode.env.openExternal(
        vscode.Uri.parse(
          "https://trypear.ai/blog/how-to-setup-aider-in-pearai",
        ),
      );
      return;
    }

    vscode.window.showInformationMessage("Installing Python 3.9");
    const terminal = vscode.window.createTerminal("Python Installer");
    terminal.show();
    terminal.sendText(getPythonInstallCommand());

    vscode.window.showInformationMessage(
      "Please restart PearAI after python installation completes sucessfully, and then run Creator (Aider) again.",
      "OK",
    );

    return;
  }

  if (!isAiderInstalled) {
    vscode.window.showInformationMessage("Installing Aider");
    const aiderTerminal = vscode.window.createTerminal("Aider Installer");
    aiderTerminal.show();
    let command = "";
    if (IS_WINDOWS) {
      command += "python -m pip install -U aider-chat;";
      command += 'echo "`nAider installation complete."';
      } else {
      command += "python3 -m pip install -U aider-chat;";
      command += "echo '\nAider installation complete.'";
    }
    aiderTerminal.sendText(command);
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
