import { getTsConfigPath, migrate } from "core/util/paths";
import * as fs from "fs";
import path from "path";
import { v4 } from "uuid";
import * as vscode from "vscode";
import { registerAllCommands } from "../commands";
import IdeProtocolClient from "../continueIdeClient";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
import registerQuickFixProvider from "../lang-server/codeActions";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import {
  ContinueCompletionProvider,
  setupStatusBar,
} from "../lang-server/completionProvider";
import { vsCodeIndexCodebase } from "../util/indexCodebase";
import { getExtensionUri } from "../util/vscode";
import { setupInlineTips } from "./inlineTips";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;
export let ideProtocolClient: IdeProtocolClient;
export let windowId: string = v4();

export async function showTutorial() {
  const tutorialPath = path.join(
    getExtensionUri().fsPath,
    "continue_tutorial.py"
  );
  // Ensure keyboard shortcuts match OS
  if (process.platform !== "darwin") {
    let tutorialContent = fs.readFileSync(tutorialPath, "utf8");
    tutorialContent = tutorialContent.replace("⌘", "^");
    fs.writeFileSync(tutorialPath, tutorialContent);
  }

  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(tutorialPath)
  );
  await vscode.window.showTextDocument(doc);
}

async function openTutorialFirstTime(context: vscode.ExtensionContext) {
  if (context.globalState.get<boolean>("continue.tutorialShown") !== true) {
    await showTutorial();
    context.globalState.update("continue.tutorialShown", true);
  }
}

function showRefactorMigrationMessage() {
  // Only if the vscode setting continue.manuallyRunningSserver is true
  const manuallyRunningServer =
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("manuallyRunningServer") || false;
  if (
    manuallyRunningServer &&
    extensionContext?.globalState.get<boolean>(
      "continue.showRefactorMigrationMessage"
    ) !== false
  ) {
    vscode.window
      .showInformationMessage(
        "The Continue server protocol was recently updated in a way that requires the latest server version to work properly. Since you are manually running the server, please be sure to upgrade with `pip install --upgrade continuedev`.",
        "Got it",
        "Don't show again"
      )
      .then((selection) => {
        if (selection === "Don't show again") {
          // Get the global state
          extensionContext?.globalState.update(
            "continue.showRefactorMigrationMessage",
            false
          );
        }
      });
  }
}

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();

  extensionContext = context;

  // Register commands and providers
  registerAllCodeLensProviders(context);
  registerAllCommands(context);
  registerQuickFixProvider();
  await openTutorialFirstTime(context);
  setupInlineTips(context);
  showRefactorMigrationMessage();
  const config = vscode.workspace.getConfiguration("continue");
  const enabled = config.get<boolean>("enableTabAutocomplete");

  // Register inline completion provider (odd versions are pre-release)
  if (parseInt(context.extension.packageJSON.version.split(".")[1]) % 2 !== 0) {
    setupStatusBar(enabled);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        new ContinueCompletionProvider()
      )
    );
  }

  ideProtocolClient = new IdeProtocolClient(context);

  // Register Continue GUI as sidebar webview, and beginning a new session
  const provider = new ContinueGUIWebviewViewProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "continue.continueGUIView",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  vsCodeIndexCodebase(ideProtocolClient.getWorkspaceDirectories());

  migrate("showWelcome", () => {
    vscode.commands.executeCommand(
      "markdown.showPreview",
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "media", "welcome.md")
      )
    );
  });

  // (async () => {
  //   const defaultDocsPages = [
  //     ["Socket.IO", "https://python-socketio.readthedocs.io/en/stable"],
  //     // ["Flask", "https://flask.palletsprojects.com/en/2.0.x/"],
  //   ];

  //   const config = await configHandler.loadConfig(new VsCodeIde());

  //   defaultDocsPages.forEach(async ([title, url]) => {
  //     for await (const update of indexDocs(
  //       title,
  //       new URL(url),
  //       config.embeddingsProvider
  //     )) {
  //       console.log(update.progress, update.desc);
  //     }
  //   });
  // })();

  try {
    // Add icon theme for .continueignore
    const iconTheme = vscode.workspace
      .getConfiguration("workbench")
      .get("iconTheme");

    let found = false;
    for (let i = vscode.extensions.all.length - 1; i >= 0; i--) {
      if (found) {
        break;
      }
      const extension = vscode.extensions.all[i];
      if (extension.packageJSON?.contributes?.iconThemes?.length > 0) {
        for (const theme of extension.packageJSON.contributes.iconThemes) {
          if (theme.id === iconTheme) {
            const themePath = path.join(extension.extensionPath, theme.path);
            const themeJson = JSON.parse(fs.readFileSync(themePath).toString());
            themeJson.iconDefinitions["_f_continue"] = {
              fontCharacter: "⚙️",
              fontColor: "#fff",
            };
            themeJson.fileNames[".continueignore"] = "_f_continue";
            themeJson.fileNames[".continuerc.json"] = "_f_continue";
            themeJson.fileNames["config.json"] = "_f_continue";
            fs.writeFileSync(themePath, JSON.stringify(themeJson));
            found = true;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.log("Error adding .continueignore file icon: ", e);
  }
}
