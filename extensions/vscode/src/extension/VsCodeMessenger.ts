import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import { WEBVIEW_TO_CORE_PASS_THROUGH } from "core/protocol/passThrough";
import { InProcessMessenger, Message } from "core/util/messenger";
import { getConfigJsonPath } from "core/util/paths";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeIde } from "../ideProtocol";
import { getExtensionUri } from "../util/vscode";
import {
  ToCoreOrIdeFromWebviewProtocol,
  VsCodeWebviewProtocol,
} from "../webviewProtocol";

/**
 * A shared messenger class between Core and Webview
 * so we don't have to rewrite some of the handlers
 */
export class VsCodeMessenger {
  onWebview<T extends keyof ToCoreOrIdeFromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<ToCoreOrIdeFromWebviewProtocol[T][0]>,
    ) =>
      | Promise<ToCoreOrIdeFromWebviewProtocol[T][1]>
      | ToCoreOrIdeFromWebviewProtocol[T][1],
  ): void {
    this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromCoreProtocol[T][0]>,
    ) => Promise<ToIdeFromCoreProtocol[T][1]> | ToIdeFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: VsCodeIde,
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
  ) {
    /** WEBVIEW LISTENERS **/
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });
    this.onWebview("openConfigJson", (msg) => {
      this.ide.openFile(getConfigJsonPath());
    });
    this.onWebview("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(5, 0);
          const range = new vscode.Range(start, end);

          const contents = document.getText(range);
          return contents;
        });
    });
    this.onWebview("toggleDevTools", (msg) => {
      vscode.commands.executeCommand("workbench.action.toggleDevTools");
      vscode.commands.executeCommand("continue.viewLogs");
    });
    this.onWebview("reloadWindow", (msg) => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", (msg) => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.onWebview("toggleFullScreen", (msg) => {
      vscode.commands.executeCommand("continue.toggleFullScreen");
    });

    // IDE
    this.onWebview("getDiff", async (msg) => {
      return await ide.getDiff();
    });
    this.onWebview("getTerminalContents", async (msg) => {
      return await ide.getTerminalContents();
    });
    this.onWebview("getDebugLocals", async (msg) => {
      return await ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebview("getAvailableThreads", async (msg) => {
      return await ide.getAvailableThreads();
    });
    this.onWebview("getTopLevelCallStackSources", async (msg) => {
      return await ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebview("listWorkspaceContents", async (msg) => {
      return await ide.listWorkspaceContents();
    });
    this.onWebview("getWorkspaceDirs", async (msg) => {
      return await ide.getWorkspaceDirs();
    });
    this.onWebview("listFolders", async (msg) => {
      return await ide.listFolders();
    });
    this.onWebview("writeFile", async (msg) => {
      return await ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebview("showVirtualFile", async (msg) => {
      return await ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebview("getContinueDir", async (msg) => {
      return await ide.getContinueDir();
    });
    this.onWebview("openFile", async (msg) => {
      return await ide.openFile(msg.data.path);
    });
    this.onWebview("runCommand", async (msg) => {
      await ide.runCommand(msg.data.command);
    });
    this.onWebview("getSearchResults", async (msg) => {
      return await ide.getSearchResults(msg.data.query);
    });
    this.onWebview("subprocess", async (msg) => {
      return await ide.subprocess(msg.data.command);
    });
    // History

    this.onWebview("saveFile", async (msg) => {
      return await ide.saveFile(msg.data.filepath);
    });
    this.onWebview("readFile", async (msg) => {
      return await ide.readFile(msg.data.filepath);
    });
    this.onWebview("showDiff", async (msg) => {
      return await ide.showDiff(
        msg.data.filepath,
        msg.data.newContents,
        msg.data.stepIndex,
      );
    });

    this.onWebview("getProblems", async (msg) => {
      return await ide.getProblems(msg.data.filepath);
    });
    this.onWebview("getBranch", async (msg) => {
      const { dir } = msg.data;
      return await ide.getBranch(dir);
    });
    this.onWebview("getOpenFiles", async (msg) => {
      return await ide.getOpenFiles();
    });
    this.onWebview("getPinnedFiles", async (msg) => {
      return await ide.getPinnedFiles();
    });
    this.onWebview("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return await ide.showLines(filepath, startLine, endLine);
    });
    // Other
    this.onWebview("errorPopup", (msg) => {
      vscode.window
        .showErrorMessage(msg.data.message, "Show Logs")
        .then((selection) => {
          if (selection === "Show Logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
    });
    this.onWebview("applyToCurrentFile", async (msg) => {
      // Select the entire current file
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor to apply edits to");
        return;
      }
      const document = editor.document;
      const start = new vscode.Position(0, 0);
      const end = new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length,
      );
      editor.selection = new vscode.Selection(start, end);

      this.verticalDiffManager.streamEdit(
        `The following code was suggested as an edit:\n\`\`\`\n${msg.data.text}\n\`\`\`\nPlease apply it to the previous code.`,
        await this.webviewProtocol.request("getDefaultModelTitle", undefined),
      );
    });
    this.onWebview("showTutorial", async (msg) => {
      const tutorialPath = path.join(
        getExtensionUri().fsPath,
        "continue_tutorial.py",
      );
      // Ensure keyboard shortcuts match OS
      if (process.platform !== "darwin") {
        let tutorialContent = fs.readFileSync(tutorialPath, "utf8");
        tutorialContent = tutorialContent
          .replace("⌘", "^")
          .replace("Cmd", "Ctrl");
        fs.writeFileSync(tutorialPath, tutorialContent);
      }

      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(tutorialPath),
      );
      await vscode.window.showTextDocument(doc);
    });

    this.onWebview("openUrl", (msg) => {
      vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });
    this.onWebview("insertAtCursor", async (msg) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.selection) {
        return;
      }

      editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });

    /** PASS THROUGH **/
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
        );
      });
    });
  }
}
