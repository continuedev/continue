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
import { WebsocketMessenger } from "./util/messenger";
import { diffManager } from "./diffs";
const os = require("os");
const path = require("path");

const continueVirtualDocumentScheme = "continue";

class IdeProtocolClient {
  private messenger: WebsocketMessenger | null = null;
  private readonly context: vscode.ExtensionContext;

  private _makingEdit = 0;

  private _highlightDebounce: NodeJS.Timeout | null = null;

  private _lastReloadTime: number = 16;
  private _reconnectionTimeouts: NodeJS.Timeout[] = [];

  sessionId: string | null = null;
  private _serverUrl: string;

  private _newWebsocketMessenger() {
    const requestUrl =
      this._serverUrl + (this.sessionId ? `?session_id=${this.sessionId}` : "");
    const messenger = new WebsocketMessenger(requestUrl);
    this.messenger = messenger;

    const reconnect = () => {
      this.messenger = null;

      // Exponential backoff to reconnect
      this._reconnectionTimeouts.forEach((to) => clearTimeout(to));

      const timeout = setTimeout(() => {
        if (this.messenger?.websocket?.readyState === 1) {
          return;
        }
        this._newWebsocketMessenger();
      }, this._lastReloadTime);

      this._reconnectionTimeouts.push(timeout);
      this._lastReloadTime = Math.min(2 * this._lastReloadTime, 5000);
    };
    messenger.onOpen(() => {
      this._reconnectionTimeouts.forEach((to) => clearTimeout(to));
    });
    messenger.onClose(() => {
      reconnect();
    });
    messenger.onError(() => {
      reconnect();
    });
    messenger.onMessage((messageType, data, messenger) => {
      this.handleMessage(messageType, data, messenger).catch((err) => {
        vscode.window
          .showErrorMessage(
            "Error handling message from Continue server: " + err.message,
            "View Logs"
          )
          .then((selection) => {
            if (selection === "View Logs") {
              vscode.commands.executeCommand("continue.viewLogs");
            }
          });
      });
    });
  }

  constructor(serverUrl: string, context: vscode.ExtensionContext) {
    this.context = context;
    this._serverUrl = serverUrl;
    this._newWebsocketMessenger();

    // Setup listeners for any file changes in open editors
    // vscode.workspace.onDidChangeTextDocument((event) => {
    //   if (this._makingEdit === 0) {
    //     let fileEdits: FileEditWithFullContents[] = event.contentChanges.map(
    //       (change) => {
    //         return {
    //           fileEdit: {
    //             filepath: event.document.uri.fsPath,
    //             range: {
    //               start: {
    //                 line: change.range.start.line,
    //                 character: change.range.start.character,
    //               },
    //               end: {
    //                 line: change.range.end.line,
    //                 character: change.range.end.character,
    //               },
    //             },
    //             replacement: change.text,
    //           },
    //           fileContents: event.document.getText(),
    //         };
    //       }
    //     );
    //     this.messenger?.send("fileEdits", { fileEdits });
    //   } else {
    //     this._makingEdit--;
    //   }
    // });

    // Listen for new file creation
    vscode.workspace.onDidCreateFiles((event) => {
      const filepaths = event.files.map((file) => file.fsPath);
      this.messenger?.send("filesCreated", { filepaths });
    });

    // Listen for file deletion
    vscode.workspace.onDidDeleteFiles((event) => {
      const filepaths = event.files.map((file) => file.fsPath);
      this.messenger?.send("filesDeleted", { filepaths });
    });

    // Listen for file renaming
    vscode.workspace.onDidRenameFiles((event) => {
      const oldFilepaths = event.files.map((file) => file.oldUri.fsPath);
      const newFilepaths = event.files.map((file) => file.newUri.fsPath);
      this.messenger?.send("filesRenamed", {
        old_filepaths: oldFilepaths,
        new_filepaths: newFilepaths,
      });
    });

    // Listen for file saving
    vscode.workspace.onDidSaveTextDocument((event) => {
      const filepath = event.uri.fsPath;
      const contents = event.getText();
      this.messenger?.send("fileSaved", { filepath, contents });

      if (event.fileName.endsWith("config.py")) {
        if (
          this.context.globalState.get<boolean>(
            "continue.showConfigInfoMessage"
          ) !== false
        ) {
          vscode.window
            .showInformationMessage(
              "Reload the VS Code window for your changes to the Continue config to take effect.",
              "Reload",
              "Don't show again"
            )
            .then((selection) => {
              if (selection === "Don't show again") {
                // Get the global state
                context.globalState.update(
                  "continue.showConfigInfoMessage",
                  false
                );
              } else if (selection === "Reload") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              }
            });
        }
      }
    });

    // Setup listeners for any selection changes in open editors
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!this.editorIsCode(event.textEditor)) {
        return;
      }
      if (this._highlightDebounce) {
        clearTimeout(this._highlightDebounce);
      }
      this._highlightDebounce = setTimeout(() => {
        const highlightedCode = event.textEditor.selections
          .filter((s) => !s.isEmpty)
          .map((selection) => {
            const range = new vscode.Range(selection.start, selection.end);
            const contents = event.textEditor.document.getText(range);
            return {
              filepath: event.textEditor.document.uri.fsPath,
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
          });
        this.sendHighlightedCode(highlightedCode);
      }, 100);
    });

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
      }
    });
  }

  visibleMessages: Set<string> = new Set();

  async handleMessage(
    messageType: string,
    data: any,
    messenger: WebsocketMessenger
  ) {
    switch (messageType) {
      case "highlightedCode":
        messenger.send("highlightedCode", {
          highlightedCode: this.getHighlightedCode(),
        });
        break;
      case "workspaceDirectory":
        messenger.send("workspaceDirectory", {
          workspaceDirectory: this.getWorkspaceDirectory(),
        });
        break;
      case "uniqueId":
        messenger.send("uniqueId", {
          uniqueId: this.getUniqueId(),
        });
        break;
      case "fileExists":
        messenger.send("fileExists", {
          exists: await this.fileExists(data.filepath),
        });
        break;
      case "getUserSecret":
        messenger.send("getUserSecret", {
          value: await this.getUserSecret(data.key),
        });
        break;
      case "openFiles":
        messenger.send("openFiles", {
          openFiles: this.getOpenFiles(),
        });
        break;
      case "visibleFiles":
        messenger.send("visibleFiles", {
          visibleFiles: this.getVisibleFiles(),
        });
        break;
      case "readFile":
        messenger.send("readFile", {
          contents: await this.readFile(data.filepath),
        });
        break;
      case "getTerminalContents":
        messenger.send("getTerminalContents", {
          contents: await this.getTerminalContents(),
        });
        break;
      case "listDirectoryContents":
        messenger.send("listDirectoryContents", {
          contents: await this.getDirectoryContents(
            data.directory,
            data.recursive || false
          ),
        });
        break;
      case "editFile":
        const fileEdit = await this.editFile(data.edit);
        messenger.send("editFile", {
          fileEdit,
        });
        break;
      case "highlightCode":
        this.highlightCode(data.rangeInFile, data.color);
        break;
      case "runCommand":
        messenger.send("runCommand", {
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
      case "getSessionId":
      case "connected":
        break;
      default:
        throw Error("Unknown message type:" + messageType);
    }
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

  async showDiff(filepath: string, replacement: string, step_index: number) {
    await diffManager.writeDiff(filepath, replacement, step_index);
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

  async getSessionId(): Promise<string> {
    await new Promise((resolve, reject) => {
      // Repeatedly try to connect to the server
      const interval = setInterval(() => {
        if (
          this.messenger &&
          this.messenger.websocket.readyState === 1 // 1 => OPEN
        ) {
          clearInterval(interval);
          resolve(null);
        } else {
          // console.log("Websocket not yet open, trying again...");
        }
      }, 1000);
    });
    console.log("Getting session ID");
    const resp = await this.messenger?.sendAndReceive("getSessionId", {});
    console.log("New Continue session with ID: ", resp.sessionId);
    this.sessionId = resp.sessionId;
    return resp.sessionId;
  }

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
  private editorIsCode(editor: vscode.TextEditor) {
    return !(
      editor.document.languageId === "plaintext" &&
      editor.document.getText() === "accessible-buffer-accessible-buffer-"
    );
  }

  getOpenFiles(): string[] {
    return vscode.window.visibleTextEditors
      .filter((editor) => this.editorIsCode(editor))
      .map((editor) => {
        return editor.document.uri.fsPath;
      });
  }

  getVisibleFiles(): string[] {
    return vscode.window.visibleTextEditors
      .filter((editor) => this.editorIsCode(editor))
      .map((editor) => {
        return editor.document.uri.fsPath;
      });
  }

  saveFile(filepath: string) {
    vscode.window.visibleTextEditors
      .filter((editor) => this.editorIsCode(editor))
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
    let nameAndType = (
      await vscode.workspace.fs.readDirectory(uriFromFilePath(directory))
    ).filter(([name, type]) => {
      const DEFAULT_IGNORE_DIRS = [
        ".git",
        ".vscode",
        ".idea",
        ".vs",
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
    let contents: string | undefined;
    if (typeof contents === "undefined") {
      try {
        contents = await vscode.workspace.fs
          .readFile(uriFromFilePath(filepath))
          .then((bytes) => new TextDecoder().decode(bytes));
      } catch {
        contents = "";
      }
    }
    return contents;
  }

  async getTerminalContents(): Promise<string> {
    const tempCopyBuffer = await vscode.env.clipboard.readText();
    await vscode.commands.executeCommand("workbench.action.terminal.selectAll");
    await vscode.commands.executeCommand(
      "workbench.action.terminal.copySelection"
    );
    await vscode.commands.executeCommand(
      "workbench.action.terminal.clearSelection"
    );
    const terminalContents = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(tempCopyBuffer);
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
      .filter((editor) => this.editorIsCode(editor))
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
      vscode.window.terminals[0].sendText(command);
    } else {
      const terminal = vscode.window.createTerminal();
      terminal.show();
      terminal.sendText(command);
    }
  }

  sendCommandOutput(output: string) {
    this.messenger?.send("commandOutput", { output });
  }

  sendHighlightedCode(highlightedCode: (RangeInFile & { contents: string })[]) {
    this.messenger?.send("highlightedCodePush", { highlightedCode });
  }

  sendAcceptRejectSuggestion(accepted: boolean) {
    this.messenger?.send("acceptRejectSuggestion", { accepted });
  }

  sendAcceptRejectDiff(accepted: boolean) {
    this.messenger?.send("acceptRejectDiff", { accepted });
  }

  sendMainUserInput(input: string) {
    this.messenger?.send("mainUserInput", { input });
  }

  async debugTerminal() {
    const contents = await this.getTerminalContents();
    this.messenger?.send("debugTerminal", { contents });
  }

  deleteAtIndex(index: number) {
    this.messenger?.send("deleteAtIndex", { index });
  }
}

export default IdeProtocolClient;
