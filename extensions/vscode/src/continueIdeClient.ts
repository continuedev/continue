import {
  editorSuggestionsLocked,
  showSuggestion as showSuggestionInEditor,
  SuggestionRanges,
} from "./suggestions";
import {
  getUniqueId,
  openEditorAndRevealRange,
  uriFromFilePath,
} from "./util/vscode";
import { FileEdit } from "../schema/FileEdit";
import { RangeInFile } from "../schema/RangeInFile";
import * as vscode from "vscode";
import {
  acceptSuggestionCommand,
  rejectSuggestionCommand,
} from "./suggestions";
import { FileEditWithFullContents } from "../schema/FileEditWithFullContents";
import { diffManager } from "./diffs";
const os = require("os");
const path = require("path");
import { v4 } from "uuid";
import { windowId } from "./activation/activate";
import * as io from "socket.io-client";
import { debugPanelWebview, getSidebarContent } from "./debugPanel";

const continueVirtualDocumentScheme = "continue";

class IdeProtocolClient {
  private readonly context: vscode.ExtensionContext;

  private _makingEdit = 0;

  private _serverUrl: string;
  private socket: io.Socket;

  private send(messageType: string, messageId: string, data: object) {
    const payload = JSON.stringify({
      message_type: messageType,
      data,
      message_id: messageId,
    });
    this.socket.send(payload);
  }

  constructor(serverUrl: string, context: vscode.ExtensionContext) {
    this.context = context;
    this._serverUrl = serverUrl;
    const windowInfo = {
      window_id: windowId,
      workspace_directory: this.getWorkspaceDirectory(),
      unique_id: this.getUniqueId(),
      ide_info: {
        name: "vscode",
        version: vscode.version,
        remote_name: vscode.env.remoteName,
      },
    };

    const requestUrl = `${this._serverUrl}?window_info=${encodeURIComponent(
      JSON.stringify(windowInfo)
    )}`;
    console.log("Connecting to Continue server at: ", requestUrl);
    this.socket = io.io(requestUrl, {
      path: "/ide/socket.io",
      transports: ["websocket", "polling", "flashsocket"],
    });

    this.socket.on("message", (message, callback) => {
      const {
        message_type: messageType,
        data,
        message_id: messageId,
      } = message;
      this.handleMessage(messageType, data, messageId, callback).catch(
        (err) => {
          console.log("Error handling message: ", err);
          vscode.window
            .showErrorMessage(
              `Error handling message (${messageType}) from Continue server: ` +
                err,
              "View Logs"
            )
            .then((selection) => {
              if (selection === "View Logs") {
                vscode.commands.executeCommand("continue.viewLogs");
              }
            });
        }
      );
    });

    // Listen for new file creation
    vscode.workspace.onDidCreateFiles((event) => {
      const filepaths = event.files.map((file) => file.fsPath);
      this.send("filesCreated", v4(), { filepaths });
    });

    // Listen for file deletion
    vscode.workspace.onDidDeleteFiles((event) => {
      const filepaths = event.files.map((file) => file.fsPath);
      this.send("filesDeleted", v4(), { filepaths });
    });

    // Listen for file renaming
    vscode.workspace.onDidRenameFiles((event) => {
      const oldFilepaths = event.files.map((file) => file.oldUri.fsPath);
      const newFilepaths = event.files.map((file) => file.newUri.fsPath);
      this.send("filesRenamed", v4(), {
        old_filepaths: oldFilepaths,
        new_filepaths: newFilepaths,
      });
    });

    // Listen for file saving
    vscode.workspace.onDidSaveTextDocument((event) => {
      const filepath = event.uri.fsPath;
      const contents = event.getText();
      this.send("fileSaved", v4(), { filepath, contents });
    });

    // Setup listeners for any selection changes in open editors
    // vscode.window.onDidChangeTextEditorSelection((event) => {
    //   if (!this.editorIsCode(event.textEditor)) {
    //     return;
    //   }
    //   if (this._highlightDebounce) {
    //     clearTimeout(this._highlightDebounce);
    //   }
    //   this._highlightDebounce = setTimeout(() => {
    //     const highlightedCode = event.textEditor.selections
    //       .filter((s) => !s.isEmpty)
    //       .map((selection) => {
    //         const range = new vscode.Range(selection.start, selection.end);
    //         const contents = event.textEditor.document.getText(range);
    //         return {
    //           filepath: event.textEditor.document.uri.fsPath,
    //           contents,
    //           range: {
    //             start: {
    //               line: selection.start.line,
    //               character: selection.start.character,
    //             },
    //             end: {
    //               line: selection.end.line,
    //               character: selection.end.character,
    //             },
    //           },
    //         };
    //       });
    //     this.sendHighlightedCode(highlightedCode);
    //   }, 100);
    // });

    // Register a content provider for the readonly virtual documents
    const documentContentProvider = new (class
      implements vscode.TextDocumentContentProvider
    {
      // emitter and its event
      onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidChange = this.onDidChangeEmitter.event;

      provideTextDocumentContent(uri: vscode.Uri): string {
        return uri.query;
      }
    })();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        continueVirtualDocumentScheme,
        documentContentProvider
      )
    );

    // Listen for changes to settings.json
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("continue")) {
        vscode.window
          .showInformationMessage(
            "Please reload VS Code for changes to Continue settings to take effect.",
            "Reload"
          )
          .then((selection) => {
            if (selection === "Reload") {
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });

        const telemetryEnabled = vscode.workspace
          .getConfiguration("continue")
          .get<boolean>("telemetryEnabled");
        if (
          typeof telemetryEnabled !== "undefined" &&
          telemetryEnabled !== null
        ) {
          this.setTelemetryEnabled(telemetryEnabled);
        }
      }
    });
  }

  visibleMessages: Set<string> = new Set();

  async handleMessage(
    messageType: string,
    data: any,
    messageId: string,
    callback: (data: any) => void
  ) {
    const respond = (responseData: any) => {
      if (typeof callback === "undefined") {
        console.log("callback is undefined");
        return;
      }
      callback({
        message_type: messageType,
        data: responseData,
        message_id: messageId,
      });
    };
    switch (messageType) {
      case "highlightedCode":
        respond({
          highlightedCode: this.getHighlightedCode(),
        });
        break;
      case "workspaceDirectory":
        respond({
          workspaceDirectory: this.getWorkspaceDirectory(),
        });
        break;
      case "uniqueId":
        respond({
          uniqueId: this.getUniqueId(),
        });
        break;
      case "ide":
        respond({
          name: "vscode",
          version: vscode.version,
          remoteName: vscode.env.remoteName,
        });
        break;
      case "fileExists":
        respond({
          exists: await this.fileExists(data.filepath),
        });
        break;
      case "getUserSecret":
        respond({
          value: await this.getUserSecret(data.key),
        });
        break;
      case "openFiles":
        respond({
          openFiles: this.getOpenFiles(),
        });
        break;
      case "visibleFiles":
        respond({
          visibleFiles: this.getVisibleFiles(),
        });
        break;
      case "readFile":
        respond({
          contents: await this.readFile(data.filepath),
        });
        break;
      case "getTerminalContents":
        respond({
          contents: await this.getTerminalContents(data.commands),
        });
        break;
      case "listDirectoryContents":
        let contents: string[] = [];
        try {
          contents = await this.getDirectoryContents(
            data.directory,
            data.recursive || false
          );
        } catch (e) {
          console.log("Error listing directory contents: ", e);
          contents = [];
        }
        respond({
          contents,
        });
        break;
      case "editFile":
        const fileEdit = await this.editFile(data.edit);
        respond({
          fileEdit,
        });
        break;
      case "highlightCode":
        this.highlightCode(data.rangeInFile, data.color);
        break;
      case "runCommand":
        respond({
          output: await this.runCommand(data.command),
        });
        break;
      case "saveFile":
        this.saveFile(data.filepath);
        break;
      case "setFileOpen":
        this.openFile(data.filepath);
        // TODO: Close file if False
        break;
      case "showMessage":
        if (!this.visibleMessages.has(data.message)) {
          this.visibleMessages.add(data.message);
          vscode.window
            .showInformationMessage(data.message, "Copy Traceback", "View Logs")
            .then((selection) => {
              if (selection === "View Logs") {
                vscode.commands.executeCommand("continue.viewLogs");
              } else if (selection === "Copy Traceback") {
                vscode.env.clipboard.writeText(data.message);
              }
            });
        }
        break;
      case "showVirtualFile":
        this.showVirtualFile(data.name, data.contents);
        break;
      case "setSuggestionsLocked":
        this.setSuggestionsLocked(data.filepath, data.locked);
        break;
      case "showSuggestion":
        this.showSuggestion(data.edit);
        break;
      case "showDiff":
        await this.showDiff(data.filepath, data.replacement, data.step_index);
        break;
      case "showMultiFileEdit":
        this.showMultiFileEdit(data.edits);
        break;
      case "getSessionId":
      case "connected":
        break;
      case "textDocument/definition":
        respond({
          locations: await this.gotoDefinition(data.filepath, data.position),
        });
        break;
      case "textDocument/documentSymbol":
        respond({ symbols: await this.documentSymbol(data.filepath) });
        break;
      case "textDocument/references":
        const locations = await this.references(data.filepath, data.position);
        respond({
          locations,
        });
        break;
      case "textDocument/foldingRange":
        respond({
          ranges: await this.foldingRanges(data.filepath),
        });
        break;
      default:
        throw Error("Unknown message type:" + messageType);
    }
  }

  async gotoDefinition(
    filepath: string,
    position: vscode.Position
  ): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      uriFromFilePath(filepath),
      position
    );
    return locations;
  }

  async documentSymbol(filepath: string): Promise<vscode.DocumentSymbol[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      uriFromFilePath(filepath)
    );
  }

  async references(
    filepath: string,
    position: vscode.Position
  ): Promise<vscode.Location[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      uriFromFilePath(filepath),
      position
    );
  }

  async foldingRanges(filepath: string): Promise<vscode.FoldingRange[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeFoldingRangeProvider",
      uriFromFilePath(filepath)
    );
  }

  getWorkspaceDirectory() {
    if (!vscode.workspace.workspaceFolders) {
      // Return the home directory
      return os.homedir();
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  getUniqueId() {
    return getUniqueId();
  }

  // ------------------------------------ //
  // On message handlers

  private _lastDecorationType: vscode.TextEditorDecorationType | null = null;
  async highlightCode(rangeInFile: RangeInFile, color: string) {
    const range = new vscode.Range(
      rangeInFile.range.start.line,
      rangeInFile.range.start.character,
      rangeInFile.range.end.line,
      rangeInFile.range.end.character
    );
    const editor = await openEditorAndRevealRange(
      rangeInFile.filepath,
      range,
      vscode.ViewColumn.One
    );
    if (editor) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: true,
      });
      editor.setDecorations(decorationType, [range]);

      const cursorDisposable = vscode.window.onDidChangeTextEditorSelection(
        (event) => {
          if (event.textEditor.document.uri.fsPath === rangeInFile.filepath) {
            cursorDisposable.dispose();
            editor.setDecorations(decorationType, []);
          }
        }
      );

      setTimeout(() => {
        cursorDisposable.dispose();
        editor.setDecorations(decorationType, []);
      }, 2500);

      if (this._lastDecorationType) {
        editor.setDecorations(this._lastDecorationType, []);
      }
      this._lastDecorationType = decorationType;
    }
  }

  showSuggestion(edit: FileEdit) {
    // showSuggestion already exists
    showSuggestionInEditor(
      edit.filepath,
      new vscode.Range(
        edit.range.start.line,
        edit.range.start.character,
        edit.range.end.line,
        edit.range.end.character
      ),
      edit.replacement
    );
  }

  async setTelemetryEnabled(enabled: boolean) {
    this.send("setTelemetryEnabled", v4(), { enabled });
  }

  async showDiff(filepath: string, replacement: string, step_index: number) {
    await diffManager.writeDiff(filepath, replacement, step_index);
  }

  showMultiFileEdit(edits: FileEdit[]) {
    vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    const panel = vscode.window.createWebviewPanel(
      "continue.continueGUIView",
      "Continue",
      vscode.ViewColumn.One
    );
    panel.webview.html = getSidebarContent(panel, "/monaco", edits);
  }

  openFile(filepath: string) {
    // vscode has a builtin open/get open files
    openEditorAndRevealRange(filepath, undefined, vscode.ViewColumn.One);
  }

  async fileExists(filepath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uriFromFilePath(filepath));
      return true;
    } catch {
      return false;
    }
  }

  showVirtualFile(name: string, contents: string) {
    vscode.workspace
      .openTextDocument(
        vscode.Uri.parse(
          `${continueVirtualDocumentScheme}:${name}?${encodeURIComponent(
            contents
          )}`
        )
      )
      .then((doc) => {
        vscode.window.showTextDocument(doc, { preview: false });
      });
  }

  setSuggestionsLocked(filepath: string, locked: boolean) {
    editorSuggestionsLocked.set(filepath, locked);
    // TODO: Rerender?
  }

  async getUserSecret(key: string) {
    // Check if secret already exists in VS Code settings (global)
    let secret = vscode.workspace.getConfiguration("continue").get(key);
    if (typeof secret !== "undefined" && secret !== null) {
      return secret;
    }

    // If not, ask user for secret
    secret = await vscode.window.showInputBox({
      prompt: `Either enter secret for ${key} or press enter to try Continue for free.`,
      password: true,
    });

    // Add secret to VS Code settings
    vscode.workspace
      .getConfiguration("continue")
      .update(key, secret, vscode.ConfigurationTarget.Global);

    return secret;
  }

  // ------------------------------------ //
  // Initiate Request

  acceptRejectSuggestion(accept: boolean, key: SuggestionRanges) {
    if (accept) {
      acceptSuggestionCommand(key);
    } else {
      rejectSuggestionCommand(key);
    }
  }

  // ------------------------------------ //
  // Respond to request

  // Checks to see if the editor is a code editor.
  // In some cases vscode.window.visibleTextEditors can return non-code editors
  // e.g. terminal editors in side-by-side mode
  private documentIsCode(document: vscode.TextDocument) {
    return (
      !(
        document.languageId === "plaintext" &&
        document.getText() === "accessible-buffer-accessible-buffer-"
      ) && !document.uri.scheme.startsWith("git")
    );
  }

  getOpenFiles(): string[] {
    return vscode.workspace.textDocuments
      .filter((document) => this.documentIsCode(document))
      .map((document) => {
        return document.uri.fsPath;
      });
  }

  getVisibleFiles(): string[] {
    return vscode.window.visibleTextEditors
      .filter((editor) => this.documentIsCode(editor.document))
      .map((editor) => {
        return editor.document.uri.fsPath;
      });
  }

  saveFile(filepath: string) {
    vscode.window.visibleTextEditors
      .filter((editor) => this.documentIsCode(editor.document))
      .forEach((editor) => {
        if (editor.document.uri.fsPath === filepath) {
          editor.document.save();
        }
      });
  }

  async getDirectoryContents(
    directory: string,
    recursive: boolean
  ): Promise<string[]> {
    const nameAndType = (
      await vscode.workspace.fs.readDirectory(uriFromFilePath(directory))
    ).filter(([name, type]) => {
      const DEFAULT_IGNORE_DIRS = [
        ".git",
        ".vscode",
        ".idea",
        ".vs",
        "venv",
        ".venv",
        "env",
        ".env",
        "node_modules",
        "dist",
        "build",
        "target",
        "out",
        "bin",
        ".pytest_cache",
        ".vscode-test",
        ".continue",
        "__pycache__",
      ];
      if (
        !DEFAULT_IGNORE_DIRS.some((dir) => name.split(path.sep).includes(dir))
      ) {
        return name;
      }
    });

    let absolutePaths = nameAndType
      .filter(([name, type]) => type === vscode.FileType.File)
      .map(([name, type]) => path.join(directory, name));
    if (recursive) {
      for (const [name, type] of nameAndType) {
        if (type === vscode.FileType.Directory) {
          const subdirectory = path.join(directory, name);
          const subdirectoryContents = await this.getDirectoryContents(
            subdirectory,
            recursive
          );
          absolutePaths = absolutePaths.concat(subdirectoryContents);
        }
      }
    }
    return absolutePaths;
  }

  async readFile(filepath: string): Promise<string> {
    const MAX_BYTES = 100000; // 0.1MB - socket.io has a 1MB limit, but seems to die a around 0.5MB
    let contents: string | undefined;
    if (typeof contents === "undefined") {
      try {
        const fileStats = await vscode.workspace.fs.stat(
          uriFromFilePath(filepath)
        );
        if (fileStats.size > 10 * MAX_BYTES) {
          return "";
        }

        const bytes = await vscode.workspace.fs.readFile(
          uriFromFilePath(filepath)
        );

        // Truncate the buffer to the first MAX_BYTES
        const truncatedBytes = bytes.slice(0, MAX_BYTES);
        contents = new TextDecoder().decode(truncatedBytes);
      } catch {
        contents = "";
      }
    }
    return contents;
  }

  async getTerminalContents(commands: number = -1): Promise<string> {
    const tempCopyBuffer = await vscode.env.clipboard.readText();
    if (commands < 0) {
      await vscode.commands.executeCommand(
        "workbench.action.terminal.selectAll"
      );
    } else {
      for (let i = 0; i < commands; i++) {
        await vscode.commands.executeCommand(
          "workbench.action.terminal.selectToPreviousCommand"
        );
      }
    }
    await vscode.commands.executeCommand(
      "workbench.action.terminal.copySelection"
    );
    await vscode.commands.executeCommand(
      "workbench.action.terminal.clearSelection"
    );
    const terminalContents = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(tempCopyBuffer);

    if (tempCopyBuffer === terminalContents) {
      // This means there is no terminal open to select text from
      return "";
    }
    return terminalContents;
  }

  editFile(edit: FileEdit): Promise<FileEditWithFullContents> {
    return new Promise((resolve, reject) => {
      openEditorAndRevealRange(
        edit.filepath,
        undefined,
        vscode.ViewColumn.One
      ).then((editor) => {
        const range = new vscode.Range(
          edit.range.start.line,
          edit.range.start.character,
          edit.range.end.line,
          edit.range.end.character
        );

        editor.edit((editBuilder) => {
          this._makingEdit += 2; // editBuilder.replace takes 2 edits: delete and insert
          editBuilder.replace(range, edit.replacement);
          resolve({
            fileEdit: edit,
            fileContents: editor.document.getText(),
          });
        });
      });
    });
  }

  getHighlightedCode(): RangeInFile[] {
    // TODO
    let rangeInFiles: RangeInFile[] = [];
    vscode.window.visibleTextEditors
      .filter((editor) => this.documentIsCode(editor.document))
      .forEach((editor) => {
        editor.selections.forEach((selection) => {
          // if (!selection.isEmpty) {
          rangeInFiles.push({
            filepath: editor.document.uri.fsPath,
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
          });
          // }
        });
      });
    return rangeInFiles;
  }

  async runCommand(command: string) {
    if (vscode.window.terminals.length) {
      vscode.window.terminals[0].show();
      vscode.window.terminals[0].sendText(command, false);
    } else {
      const terminal = vscode.window.createTerminal();
      terminal.show();
      terminal.sendText(command, false);
    }
  }

  sendCommandOutput(output: string) {
    this.send("commandOutput", v4(), { output });
  }

  sendHighlightedCode(
    highlightedCode: (RangeInFile & { contents: string })[],
    edit?: boolean
  ) {
    this.send("highlightedCodePush", v4(), {
      highlightedCode,
      edit,
    });
  }

  sendAcceptRejectSuggestion(accepted: boolean) {
    this.send("acceptRejectSuggestion", v4(), { accepted });
  }

  sendAcceptRejectDiff(accepted: boolean, stepIndex: number) {
    this.send("acceptRejectDiff", v4(), { accepted, stepIndex });
  }

  sendMainUserInput(input: string) {
    debugPanelWebview?.postMessage({
      type: "userInput",
      input,
    });
  }

  async debugTerminal() {
    const contents = (await this.getTerminalContents()).trim();
    this.send("debugTerminal", v4(), { contents });
  }
}

export default IdeProtocolClient;
