import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { ContextMenuConfig, IDE } from "core";
import { CompletionProvider } from "core/autocomplete/completionProvider";
import { ConfigHandler } from "core/config/handler";
import { ContinueServerClient } from "core/continueServer/stubs/client";
import { fetchwithRequestOptions } from "core/util/fetchWithOptions";
import { GlobalContext } from "core/util/GlobalContext";
import { getConfigJsonPath, getDevDataFilePath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import readLastLines from "read-last-lines";
import {
  StatusBarStatus,
  getStatusBarStatus,
  getStatusBarStatusFromQuickPickItemLabel,
  quickPickStatusText,
  setupStatusBar,
} from "./autocomplete/statusBar";
import { ContinueGUIWebviewViewProvider } from "./debugPanel";
import { DiffManager } from "./diff/horizontal";
import { VerticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { Battery } from "./util/battery";
import { getPlatform } from "./util/util";
import type { VsCodeWebviewProtocol } from "./webviewProtocol";

let fullScreenPanel: vscode.WebviewPanel | undefined;

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find((tab) =>
    (tab.input as any)?.viewType?.endsWith("continue.continueGUIView"),
  );
}

async function addHighlightedCodeToContext(
  edit: boolean,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (selection.isEmpty) {
      // Capture highlighted terminal text
      // const activeTerminal = vscode.window.activeTerminal;
      // if (activeTerminal) {
      //   // Copy selected text
      //   const tempCopyBuffer = await vscode.env.clipboard.readText();
      //   await vscode.commands.executeCommand(
      //     "workbench.action.terminal.copySelection",
      //   );
      //   await vscode.commands.executeCommand(
      //     "workbench.action.terminal.clearSelection",
      //   );
      //   const contents = (await vscode.env.clipboard.readText()).trim();
      //   await vscode.env.clipboard.writeText(tempCopyBuffer);

      //   // Add to context
      //   const rangeInFileWithContents = {
      //     filepath: activeTerminal.name,
      //     contents,
      //     range: {
      //       start: {
      //         line: 0,
      //         character: 0,
      //       },
      //       end: {
      //         line: contents.split("\n").length,
      //         character: 0,
      //       },
      //     },
      //   };

      //   if (contents.trim() !== "") {
      //     webviewProtocol?.request("highlightedCode", {
      //       rangeInFileWithContents,
      //     });
      //   }
      // }
      return;
    }
    // adjust starting position to include indentation
    const start = new vscode.Position(selection.start.line, 0);
    const range = new vscode.Range(start, selection.end);
    const contents = editor.document.getText(range);
    const rangeInFileWithContents = {
      filepath: editor.document.uri.fsPath,
      contents,
      range: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: {
          line: selection.end.line,
          character: selection.end.character,
        },
      },
    };

    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    });
  }
}

async function addEntireFileToContext(
  filepath: vscode.Uri,
  edit: boolean,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  // If a directory, add all files in the directory
  const stat = await vscode.workspace.fs.stat(filepath);
  if (stat.type === vscode.FileType.Directory) {
    const files = await vscode.workspace.fs.readDirectory(filepath);
    for (const [filename, type] of files) {
      if (type === vscode.FileType.File) {
        addEntireFileToContext(
          vscode.Uri.joinPath(filepath, filename),
          edit,
          webviewProtocol,
        );
      }
    }
    return;
  }

  // Get the contents of the file
  const contents = (await vscode.workspace.fs.readFile(filepath)).toString();
  const rangeInFileWithContents = {
    filepath: filepath.fsPath,
    contents: contents,
    range: {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: contents.split(os.EOL).length - 1,
        character: 0,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
  });
}

// Copy everything over from extension.ts
const commandsMap: (
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
) => { [command: string]: (...args: any) => any } = (
  ide,
  extensionContext,
  sidebar,
  configHandler,
  diffManager,
  verticalDiffManager,
  continueServerClientPromise,
  battery,
) => {
  async function streamInlineEdit(
    promptName: keyof ContextMenuConfig,
    fallbackPrompt: string,
    onlyOneInsertion?: boolean,
  ) {
    const config = await configHandler.loadConfig();
    const modelTitle =
      config.experimental?.modelRoles?.inlineEdit ??
      (await sidebar.webviewProtocol.request(
        "getDefaultModelTitle",
        undefined,
      ));
    sidebar.webviewProtocol.request("incrementFtc", undefined);
    await verticalDiffManager.streamEdit(
      config.experimental?.contextMenuPrompts?.[promptName] ?? fallbackPrompt,
      modelTitle,
      onlyOneInsertion,
    );
  }
  return {
    "continue.acceptDiff": async (newFilepath?: string | vscode.Uri) => {
      if (newFilepath instanceof vscode.Uri) {
        newFilepath = newFilepath.fsPath;
      }
      verticalDiffManager.clearForFilepath(newFilepath, true);
      await diffManager.acceptDiff(newFilepath);
    },
    "continue.rejectDiff": async (newFilepath?: string | vscode.Uri) => {
      if (newFilepath instanceof vscode.Uri) {
        newFilepath = newFilepath.fsPath;
      }
      verticalDiffManager.clearForFilepath(newFilepath, false);
      await diffManager.rejectDiff(newFilepath);
    },
    "continue.acceptVerticalDiffBlock": (filepath?: string, index?: number) => {
      verticalDiffManager.acceptRejectVerticalDiffBlock(true, filepath, index);
    },
    "continue.rejectVerticalDiffBlock": (filepath?: string, index?: number) => {
      verticalDiffManager.acceptRejectVerticalDiffBlock(false, filepath, index);
    },
    "continue.quickFix": async (
      message: string,
      code: string,
      edit: boolean,
    ) => {
      sidebar.webviewProtocol?.request("newSessionWithPrompt", {
        prompt: `${
          edit ? "/edit " : ""
        }${code}\n\nHow do I fix this problem in the above code?: ${message}`,
      });

      if (!edit) {
        vscode.commands.executeCommand("continue.continueGUIView.focus");
      }
    },
    "continue.focusContinueInput": async () => {
      const fullScreenTab = getFullScreenTab();
      if (!fullScreenTab) {
        // focus sidebar
        vscode.commands.executeCommand("continue.continueGUIView.focus");
      } else {
        // focus fullscreen
        fullScreenPanel?.reveal();
      }
      sidebar.webviewProtocol?.request("focusContinueInput", undefined);
      await addHighlightedCodeToContext(false, sidebar.webviewProtocol);
    },
    "continue.focusContinueInputWithoutClear": async () => {
      if (!getFullScreenTab()) {
        vscode.commands.executeCommand("continue.continueGUIView.focus");
      }
      sidebar.webviewProtocol?.request(
        "focusContinueInputWithoutClear",
        undefined,
      );
      await addHighlightedCodeToContext(true, sidebar.webviewProtocol);
    },
    "continue.toggleAuxiliaryBar": () => {
      vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
    },
    "continue.quickEdit": async (prompt?: string) => {
      const selectionEmpty = vscode.window.activeTextEditor?.selection.isEmpty;

      const editor = vscode.window.activeTextEditor;
      const existingHandler = verticalDiffManager.getHandlerForFile(
        editor?.document.uri.fsPath ?? "",
      );
      const previousInput = existingHandler?.input;

      const config = await configHandler.loadConfig();
      let defaultModelTitle =
        config.experimental?.modelRoles?.inlineEdit ??
        (await sidebar.webviewProtocol.request(
          "getDefaultModelTitle",
          undefined,
        ));
      if (!defaultModelTitle) {
        defaultModelTitle = config.models[0]?.title!;
      }
      const quickPickItems =
        config.contextProviders
          ?.filter((provider) => provider.description.type === "normal")
          .map((provider) => {
            return {
              label: provider.description.displayTitle,
              description: provider.description.title,
              detail: provider.description.description,
            };
          }) || [];

      const addContextMsg = quickPickItems.length
        ? " (or press enter to add context first)"
        : "";
      const textInputOptions: vscode.InputBoxOptions = {
        placeHolder: selectionEmpty
          ? `Type instructions to generate code${addContextMsg}`
          : `Describe how to edit the highlighted code${addContextMsg}`,
        title: `${getPlatform() === "mac" ? "Cmd" : "Ctrl"}+I`,
        prompt: `[${defaultModelTitle}]`,
        value: prompt,
        ignoreFocusOut: true,
      };
      if (previousInput) {
        textInputOptions.value = previousInput + ", ";
        textInputOptions.valueSelection = [
          textInputOptions.value.length,
          textInputOptions.value.length,
        ];
      }

      let text = await vscode.window.showInputBox(textInputOptions);

      if (text === undefined) {
        return;
      }

      if (text.length > 0 || quickPickItems.length === 0) {
        sidebar.webviewProtocol.request("incrementFtc", undefined);
        await verticalDiffManager.streamEdit(
          text,
          defaultModelTitle,
          undefined,
          previousInput,
        );
      } else {
        // Pick context first
        const selectedProviders = await vscode.window.showQuickPick(
          quickPickItems,
          {
            title: "Add Context",
            canPickMany: true,
          },
        );

        let text = await vscode.window.showInputBox(textInputOptions);
        if (text) {
          const llm = await configHandler.llmFromTitle();
          const config = await configHandler.loadConfig();
          const context = (
            await Promise.all(
              selectedProviders?.map((providerTitle) => {
                const provider = config.contextProviders?.find(
                  (provider) =>
                    provider.description.title === providerTitle.description,
                );
                if (!provider) {
                  return [];
                }

                return provider.getContextItems("", {
                  embeddingsProvider: config.embeddingsProvider,
                  reranker: config.reranker,
                  ide,
                  llm,
                  fullInput: text || "",
                  selectedCode: [],
                  fetch: (url, init) =>
                    fetchwithRequestOptions(url, init, config.requestOptions),
                });
              }) || [],
            )
          ).flat();

          text =
            context.map((item) => item.content).join("\n\n") +
            "\n\n---\n\n" +
            text;

          sidebar.webviewProtocol.request("incrementFtc", undefined);
          await verticalDiffManager.streamEdit(
            text,
            defaultModelTitle,
            undefined,
            previousInput,
          );
        }
      }
    },
    "continue.writeCommentsForCode": async () => {
      streamInlineEdit(
        "comment",
        "Write comments for this code. Do not change anything about the code itself.",
      );
    },
    "continue.writeDocstringForCode": async () => {
      streamInlineEdit(
        "docstring",
        "Write a docstring for this code. Do not change anything about the code itself.",
        true,
      );
    },
    "continue.fixCode": async () => {
      streamInlineEdit(
        "fix",
        "Fix this code. If it is already 100% correct, simply rewrite the code.",
      );
    },
    "continue.optimizeCode": async () => {
      streamInlineEdit("optimize", "Optimize this code");
    },
    "continue.fixGrammar": async () => {
      streamInlineEdit(
        "fixGrammar",
        "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
      );
    },
    "continue.viewLogs": async () => {
      // Open ~/.continue/continue.log
      const logFile = path.join(os.homedir(), ".continue", "continue.log");
      // Make sure the file/directory exist
      if (!fs.existsSync(logFile)) {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, "");
      }

      const uri = vscode.Uri.file(logFile);
      await vscode.window.showTextDocument(uri);
    },
    "continue.debugTerminal": async () => {
      const terminalContents = await ide.getTerminalContents();
      vscode.commands.executeCommand("continue.continueGUIView.focus");
      sidebar.webviewProtocol?.request("userInput", {
        input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
      });
    },
    "continue.hideInlineTip": () => {
      vscode.workspace
        .getConfiguration("continue")
        .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
    },

    // Commands without keyboard shortcuts
    "continue.addModel": () => {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
      sidebar.webviewProtocol?.request("addModel", undefined);
    },
    "continue.openSettingsUI": () => {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
      sidebar.webviewProtocol?.request("openSettings", undefined);
    },
    "continue.sendMainUserInput": (text: string) => {
      sidebar.webviewProtocol?.request("userInput", {
        input: text,
      });
    },
    "continue.selectRange": (startLine: number, endLine: number) => {
      if (!vscode.window.activeTextEditor) {
        return;
      }
      vscode.window.activeTextEditor.selection = new vscode.Selection(
        startLine,
        0,
        endLine,
        0,
      );
    },
    "continue.foldAndUnfold": (
      foldSelectionLines: number[],
      unfoldSelectionLines: number[],
    ) => {
      vscode.commands.executeCommand("editor.unfold", {
        selectionLines: unfoldSelectionLines,
      });
      vscode.commands.executeCommand("editor.fold", {
        selectionLines: foldSelectionLines,
      });
    },
    "continue.sendToTerminal": (text: string) => {
      ide.runCommand(text);
    },
    "continue.newSession": () => {
      sidebar.webviewProtocol?.request("newSession", undefined);
    },
    "continue.viewHistory": () => {
      sidebar.webviewProtocol?.request("viewHistory", undefined);
    },
    "continue.toggleFullScreen": () => {
      // Check if full screen is already open by checking open tabs
      const fullScreenTab = getFullScreenTab();

      // Check if the active editor is the Continue GUI View
      if (fullScreenTab && fullScreenTab.isActive) {
        //Full screen open and focused - close it
        vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
        return;
      }

      if (fullScreenTab && fullScreenPanel) {
        //Full screen open, but not focused - focus it
        fullScreenPanel.reveal();
        return;
      }

      //Full screen not open - open it
      Telemetry.capture("openFullScreen", {});

      // Close the sidebar.webviews
      // vscode.commands.executeCommand("workbench.action.closeSidebar");
      vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
      // vscode.commands.executeCommand("workbench.action.toggleZenMode");

      //create the full screen panel
      let panel = vscode.window.createWebviewPanel(
        "continue.continueGUIView",
        "Continue",
        vscode.ViewColumn.One,
        {
          retainContextWhenHidden: true,
        },
      );
      fullScreenPanel = panel;

      //Add content to the panel
      panel.webview.html = sidebar.getSidebarContent(
        extensionContext,
        panel,
        undefined,
        undefined,
        true,
      );

      //When panel closes, reset the webview and focus
      panel.onDidDispose(
        () => {
          sidebar.resetWebviewProtocolWebview();
          vscode.commands.executeCommand("continue.focusContinueInput");
        },
        null,
        extensionContext.subscriptions,
      );
    },
    "continue.openConfigJson": () => {
      ide.openFile(getConfigJsonPath());
    },
    "continue.selectFilesAsContext": (
      firstUri: vscode.Uri,
      uris: vscode.Uri[],
    ) => {
      vscode.commands.executeCommand("continue.continueGUIView.focus");

      for (const uri of uris) {
        addEntireFileToContext(uri, false, sidebar.webviewProtocol);
      }
    },
    "continue.updateAllReferences": (filepath: vscode.Uri) => {
      // Get the cursor position in the editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const position = editor.selection.active;
      sidebar.sendMainUserInput(
        `/references ${filepath.fsPath} ${position.line} ${position.character}`,
      );
    },
    "continue.logAutocompleteOutcome": (
      completionId: string,
      completionProvider: CompletionProvider,
    ) => {
      completionProvider.accept(completionId);
    },
    "continue.toggleTabAutocompleteEnabled": () => {
      const config = vscode.workspace.getConfiguration("continue");
      const enabled = config.get("enableTabAutocomplete");
      const pauseOnBattery = config.get<boolean>(
        "pauseTabAutocompleteOnBattery",
      );
      if (!pauseOnBattery || battery.isACConnected()) {
        config.update(
          "enableTabAutocomplete",
          !enabled,
          vscode.ConfigurationTarget.Global,
        );
      } else {
        if (enabled) {
          const paused = getStatusBarStatus() === StatusBarStatus.Paused;
          if (paused) {
            setupStatusBar(StatusBarStatus.Enabled);
          } else {
            config.update(
              "enableTabAutocomplete",
              false,
              vscode.ConfigurationTarget.Global,
            );
          }
        } else {
          setupStatusBar(StatusBarStatus.Paused);
          config.update(
            "enableTabAutocomplete",
            true,
            vscode.ConfigurationTarget.Global,
          );
        }
      }
    },
    "continue.openTabAutocompleteConfigMenu": async () => {
      const config = vscode.workspace.getConfiguration("continue");
      const quickPick = vscode.window.createQuickPick();
      const selected = new GlobalContext().get("selectedTabAutocompleteModel");
      const autocompleteModelTitles = ((
        await configHandler.loadConfig()
      ).tabAutocompleteModels
        ?.map((model) => model.title)
        .filter((t) => t !== undefined) || []) as string[];

      // Toggle between Disabled, Paused, and Enabled
      const pauseOnBattery =
        config.get<boolean>("pauseTabAutocompleteOnBattery") &&
        !battery.isACConnected();
      const currentStatus = getStatusBarStatus();

      let targetStatus: StatusBarStatus | undefined;
      if (pauseOnBattery) {
        // Cycle from Disabled -> Paused -> Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Paused
            ? StatusBarStatus.Enabled
            : currentStatus === StatusBarStatus.Disabled
              ? StatusBarStatus.Paused
              : StatusBarStatus.Disabled;
      } else {
        // Toggle between Disabled and Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Disabled
            ? StatusBarStatus.Enabled
            : StatusBarStatus.Disabled;
      }
      quickPick.items = [
        {
          label: quickPickStatusText(targetStatus),
        },
        {
          label: "$(gear) Configure autocomplete options",
        },
        {
          label: "$(feedback) Give feedback",
        },
        {
          kind: vscode.QuickPickItemKind.Separator,
          label: "Switch model",
        },
        ...autocompleteModelTitles.map((title) => ({
          label: title === selected ? `$(check) ${title}` : title,
          description: title === selected ? "Currently selected" : undefined,
        })),
      ];
      quickPick.onDidAccept(() => {
        const selectedOption = quickPick.selectedItems[0].label;
        const targetStatus =
          getStatusBarStatusFromQuickPickItemLabel(selectedOption);

        if (targetStatus !== undefined) {
          setupStatusBar(targetStatus);
          config.update(
            "enableTabAutocomplete",
            targetStatus === StatusBarStatus.Enabled,
            vscode.ConfigurationTarget.Global,
          );
        } else if (
          selectedOption === "$(gear) Configure autocomplete options"
        ) {
          ide.openFile(getConfigJsonPath());
        } else if (autocompleteModelTitles.includes(selectedOption)) {
          new GlobalContext().update(
            "selectedTabAutocompleteModel",
            selectedOption,
          );
          configHandler.reloadConfig();
        } else if (selectedOption === "$(feedback) Give feedback") {
          vscode.commands.executeCommand("continue.giveAutocompleteFeedback");
        }
        quickPick.dispose();
      });
      quickPick.show();
    },
    "continue.giveAutocompleteFeedback": async () => {
      const feedback = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt:
          "Please share what went wrong with the last completion. The details of the completion as well as this message will be sent to the Continue team in order to improve.",
      });
      if (feedback) {
        const client = await continueServerClientPromise;
        const completionsPath = getDevDataFilePath("autocomplete");

        const lastLines = await readLastLines.read(completionsPath, 2);
        client.sendFeedback(feedback, lastLines);
      }
    },
  };
};

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
) {
  for (const [command, callback] of Object.entries(
    commandsMap(
      ide,
      extensionContext,
      sidebar,
      configHandler,
      diffManager,
      verticalDiffManager,
      continueServerClientPromise,
      battery,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}
