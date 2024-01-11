import { FileEdit, RangeInFile } from "core";
import { getConfigJsonPath, getDevDataFilePath } from "core/util/paths";
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { debugPanelWebview, getSidebarContent } from "./debugPanel";
import { diffManager } from "./diff/horizontal";
import { configHandler } from "./loadConfig";
import {
  SuggestionRanges,
  acceptSuggestionCommand,
  editorSuggestionsLocked,
  rejectSuggestionCommand,
  showSuggestion as showSuggestionInEditor,
} from "./suggestions";
import {
  getUniqueId,
  openEditorAndRevealRange,
  uriFromFilePath,
} from "./util/vscode";

const continueVirtualDocumentScheme = "continue";

class IdeProtocolClient {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Listen for file saving
    vscode.workspace.onDidSaveTextDocument((event) => {
      const filepath = event.uri.fsPath;

      if (
        filepath.endsWith(".continue/config.json") ||
        filepath.endsWith(".continue\\config.json") ||
        filepath.endsWith(".continue/config.ts") ||
        filepath.endsWith(".continue\\config.ts") ||
        filepath.endsWith(".continuerc.json")
      ) {
        const config = readFileSync(getConfigJsonPath(), "utf8");
        const configJson = JSON.parse(config);
        this.configUpdate(configJson);
        configHandler.reloadConfig();
      } else if (
        filepath.endsWith(".continueignore") ||
        filepath.endsWith(".gitignore")
      ) {
        debugPanelWebview?.postMessage({
          type: "updateEmbeddings",
        });
      }
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
  }

  visibleMessages: Set<string> = new Set();

  configUpdate(config: any) {
    debugPanelWebview?.postMessage({
      type: "configUpdate",
      config,
    });
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

  getWorkspaceDirectories(): string[] {
    return (
      vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ||
      []
    );
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
          `${continueVirtualDocumentScheme}:${encodeURIComponent(
            name
          )}?${encodeURIComponent(contents)}`
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
      const DEFAULT_IGNORE_FILETYPES = [
        "DS_Store",
        "-lock.json",
        "lock",
        "log",
        "ttf",
        "png",
        "jpg",
        "jpeg",
        "gif",
        "mp4",
        "svg",
        "ico",
        "pdf",
        "zip",
        "gz",
        "tar",
        "dmg",
        "tgz",
        "rar",
        "7z",
        "exe",
        "dll",
        "obj",
        "o",
        "a",
        "lib",
        "so",
        "dylib",
        "ncb",
        "sdf",
        "woff",
        "woff2",
        "eot",
        "cur",
        "avi",
        "mpg",
        "mpeg",
        "mov",
        "mp3",
        "mp4",
        "mkv",
        "mkv",
        "webm",
        "jar",
      ];
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
        !DEFAULT_IGNORE_DIRS.some((dir) =>
          name.split(path.sep).includes(dir)
        ) &&
        !DEFAULT_IGNORE_FILETYPES.some((filetype) => name.endsWith(filetype))
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

  getAbsolutePath(filepath: string): string {
    const workspaceDirectories = this.getWorkspaceDirectories();
    if (!path.isAbsolute(filepath) && workspaceDirectories.length === 1) {
      return path.join(workspaceDirectories[0], filepath);
    } else {
      return filepath;
    }
  }

  async readFile(filepath: string): Promise<string> {
    filepath = this.getAbsolutePath(filepath);

    const MAX_BYTES = 100000;
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

  async getRepo(): Promise<any> {
    // Use the native git extension to get the branch name
    const extension = vscode.extensions.getExtension("vscode.git");
    if (
      typeof extension === "undefined" ||
      !extension.isActive ||
      typeof vscode.workspace.workspaceFolders === "undefined"
    ) {
      return "NONE";
    }

    const git = extension.exports.getAPI(1);
    let repo = git.getRepository(vscode.workspace.workspaceFolders[0].uri);
    if (!repo) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(null);
        }, 5000);
        extension.exports.b.onDidChangeState((s: any) => {
          clearTimeout(timeout);
          resolve(null);
        });
      });

      let repo = git.getRepository(vscode.workspace.workspaceFolders[0].uri);
      return repo;
    }
    return repo;
  }

  async getBranch(): Promise<string> {
    const repo = await this.getRepo();

    return repo?.state?.HEAD?.name || "NONE";
  }

  async getDiff(): Promise<string> {
    const repo = await this.getRepo();

    if (!repo) {
      return "";
    }

    return (await repo.getDiff()).join("\n");
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

  sendMainUserInput(input: string) {
    debugPanelWebview?.postMessage({
      type: "userInput",
      input,
    });
  }

  logDevData(tableName: string, data: any) {
    const filepath: string = getDevDataFilePath(tableName);
    const jsonLine = JSON.stringify(data);
    writeFileSync(filepath, `${jsonLine}\n`, { flag: "a" });
  }
}

export default IdeProtocolClient;
