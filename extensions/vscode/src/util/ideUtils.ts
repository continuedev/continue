import { FileEdit, RangeInFile, Thread } from "core";
import { defaultIgnoreFile } from "core/indexing/ignore";
import path from "path";
import * as vscode from "vscode";
import { threadStopped } from "../debug/debug";
import { VsCodeExtension } from "../extension/vscodeExtension";
import {
  SuggestionRanges,
  acceptSuggestionCommand,
  editorSuggestionsLocked,
  rejectSuggestionCommand,
  showSuggestion as showSuggestionInEditor,
} from "../suggestions";
import { traverseDirectory } from "./traverseDirectory";
import {
  getUniqueId,
  openEditorAndRevealRange,
  uriFromFilePath,
} from "./vscode";

const util = require("util");
const asyncExec = util.promisify(require("child_process").exec);

export class VsCodeIdeUtils {
  visibleMessages: Set<string> = new Set();

  async gotoDefinition(
    filepath: string,
    position: vscode.Position,
  ): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      uriFromFilePath(filepath),
      position,
    );
    return locations;
  }

  async documentSymbol(filepath: string): Promise<vscode.DocumentSymbol[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      uriFromFilePath(filepath),
    );
  }

  async references(
    filepath: string,
    position: vscode.Position,
  ): Promise<vscode.Location[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      uriFromFilePath(filepath),
      position,
    );
  }

  async foldingRanges(filepath: string): Promise<vscode.FoldingRange[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeFoldingRangeProvider",
      uriFromFilePath(filepath),
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
      rangeInFile.range.end.character,
    );
    const editor = await openEditorAndRevealRange(
      rangeInFile.filepath,
      range,
      vscode.ViewColumn.One,
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
        },
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
        edit.range.end.character,
      ),
      edit.replacement,
    );
  }

  showMultiFileEdit(edits: FileEdit[]) {
    vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    const panel = vscode.window.createWebviewPanel(
      "continue.continueGUIView",
      "Continue",
      vscode.ViewColumn.One,
    );
    // panel.webview.html = this.sidebar.getSidebarContent(
    //   extensionContext,
    //   panel,
    //   this.ide,
    //   "/monaco",
    //   edits
    // );
  }

  openFile(filepath: string, range?: vscode.Range) {
    // vscode has a builtin open/get open files
    return openEditorAndRevealRange(filepath, range, vscode.ViewColumn.One);
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
          `${
            VsCodeExtension.continueVirtualDocumentScheme
          }:${encodeURIComponent(name)}?${encodeURIComponent(contents)}`,
        ),
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
    return document.uri.scheme === "file";
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
    recursive: boolean,
  ): Promise<string[]> {
    if (!recursive) {
      return (
        await vscode.workspace.fs.readDirectory(uriFromFilePath(directory))
      )
        .filter(([name, type]) => {
          type === vscode.FileType.File && !defaultIgnoreFile.ignores(name);
        })
        .map(([name, type]) => path.join(directory, name));
    }

    const allFiles: string[] = [];
    const gitRoot = await this.getGitRoot(directory);
    let onlyThisDirectory = undefined;
    if (gitRoot) {
      onlyThisDirectory = directory.slice(gitRoot.length).split(path.sep);
      if (onlyThisDirectory[0] === "") {
        onlyThisDirectory.shift();
      }
    }
    for await (const file of traverseDirectory(
      gitRoot ?? directory,
      [],
      true,
      gitRoot === directory ? undefined : onlyThisDirectory,
    )) {
      allFiles.push(file);
    }
    return allFiles;
  }

  getAbsolutePath(filepath: string): string {
    const workspaceDirectories = this.getWorkspaceDirectories();
    if (!path.isAbsolute(filepath) && workspaceDirectories.length === 1) {
      return path.join(workspaceDirectories[0], filepath);
    } else {
      return filepath;
    }
  }

  private static MAX_BYTES = 100000;

  async readFile(filepath: string): Promise<string> {
    try {
      filepath = this.getAbsolutePath(filepath);
      const uri = uriFromFilePath(filepath);

      // Check first whether it's an open document
      const openTextDocument = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );
      if (openTextDocument !== undefined) {
        return openTextDocument.getText();
      }

      const fileStats = await vscode.workspace.fs.stat(
        uriFromFilePath(filepath),
      );
      if (fileStats.size > 10 * VsCodeIdeUtils.MAX_BYTES) {
        return "";
      }

      const bytes = await vscode.workspace.fs.readFile(uri);

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, VsCodeIdeUtils.MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      return contents;
    } catch {
      return "";
    }
  }

  async readRangeInFile(
    filepath: string,
    range: vscode.Range,
  ): Promise<string> {
    const contents = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(vscode.Uri.file(filepath)),
    );
    const lines = contents.split("\n");
    return (
      lines.slice(range.start.line, range.end.line).join("\n") +
      "\n" +
      lines[
        range.end.line < lines.length - 1 ? range.end.line : lines.length - 1
      ].slice(0, range.end.character)
    );
  }

  async getTerminalContents(commands: number = -1): Promise<string> {
    const tempCopyBuffer = await vscode.env.clipboard.readText();
    if (commands < 0) {
      await vscode.commands.executeCommand(
        "workbench.action.terminal.selectAll",
      );
    } else {
      for (let i = 0; i < commands; i++) {
        await vscode.commands.executeCommand(
          "workbench.action.terminal.selectToPreviousCommand",
        );
      }
    }
    await vscode.commands.executeCommand(
      "workbench.action.terminal.copySelection",
    );
    await vscode.commands.executeCommand(
      "workbench.action.terminal.clearSelection",
    );
    const terminalContents = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(tempCopyBuffer);

    if (tempCopyBuffer === terminalContents) {
      // This means there is no terminal open to select text from
      return "";
    }
    return terminalContents;
  }

  private async _getThreads(session: vscode.DebugSession) {
    const threadsResponse = await session.customRequest("threads");
    const threads = threadsResponse.threads.filter((thread: any) =>
      threadStopped.get(thread.id),
    );
    threads.sort((a: any, b: any) => a.id - b.id);
    threadsResponse.threads = threads;

    return threadsResponse;
  }

  async getAvailableThreads(): Promise<Thread[]> {
    const session = vscode.debug.activeDebugSession;
    if (!session) return [];

    const threadsResponse = await this._getThreads(session);
    return threadsResponse.threads;
  }

  async getDebugLocals(threadIndex: number = 0): Promise<string> {
    const session = vscode.debug.activeDebugSession;

    if (!session) {
      vscode.window.showWarningMessage(
        "No active debug session found, therefore no debug context will be provided for the llm.",
      );
      return "";
    }

    const variablesResponse = await session
      .customRequest("stackTrace", {
        threadId: threadIndex,
        startFrame: 0,
      })
      .then((traceResponse) =>
        session.customRequest("scopes", {
          frameId: traceResponse.stackFrames[0].id,
        }),
      )
      .then((scopesResponse) =>
        session.customRequest("variables", {
          variablesReference: scopesResponse.scopes[0].variablesReference,
        }),
      );

    const variableContext = variablesResponse.variables
      .filter((variable: any) => variable.type !== "global")
      .reduce(
        (acc: any, variable: any) =>
          `${acc}\nname: ${variable.name}, type: ${variable.type}, ` +
          `value: ${variable.value}`,
        "",
      );

    return variableContext;
  }

  async getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number = 3,
  ): Promise<string[]> {
    const session = vscode.debug.activeDebugSession;
    if (!session) return [];

    const sourcesPromises = await session
      .customRequest("stackTrace", {
        threadId: threadIndex,
        startFrame: 0,
      })
      .then((traceResponse) =>
        traceResponse.stackFrames
          .slice(0, stackDepth)
          .map(async (stackFrame: any) => {
            const scopeResponse = await session.customRequest("scopes", {
              frameId: stackFrame.id,
            });

            const scope = scopeResponse.scopes[0];

            return await this.retrieveSource(scope.source ? scope : stackFrame);
          }),
      );

    return Promise.all(sourcesPromises);
  }

  private async retrieveSource(sourceContainer: any): Promise<string> {
    if (!sourceContainer.source) return "";

    const sourceRef = sourceContainer.source.sourceReference;
    if (sourceRef && sourceRef > 0) {
      // according to the spec, source might be ony available in a debug session
      // not yet able to test this branch
      const sourceResponse =
        await vscode.debug.activeDebugSession?.customRequest("source", {
          source: sourceContainer.source,
          sourceReference: sourceRef,
        });
      return sourceResponse.content;
    } else if (sourceContainer.line && sourceContainer.endLine) {
      return await this.readRangeInFile(
        sourceContainer.source.path,
        new vscode.Range(
          sourceContainer.line - 1, // The line number from scope response starts from 1
          sourceContainer.column,
          sourceContainer.endLine - 1,
          sourceContainer.endColumn,
        ),
      );
    } else if (sourceContainer.line)
      // fall back to 5 line of context
      return await this.readRangeInFile(
        sourceContainer.source.path,
        new vscode.Range(
          sourceContainer.line - 3,
          0,
          sourceContainer.line + 2,
          0,
        ),
      );
    else return "unavailable";
  }

  private async _getRepo(forDirectory: vscode.Uri): Promise<any | undefined> {
    // Use the native git extension to get the branch name
    const extension = vscode.extensions.getExtension("vscode.git");
    if (
      typeof extension === "undefined" ||
      !extension.isActive ||
      typeof vscode.workspace.workspaceFolders === "undefined"
    ) {
      return undefined;
    }

    try {
      const git = extension.exports.getAPI(1);
      return git.getRepository(forDirectory);
    } catch (e) {
      this._repoWasNone = true;
      console.warn("Git not found: ", e);
      return undefined;
    }
  }

  private _repoWasNone: boolean = false;
  async getRepo(forDirectory: vscode.Uri): Promise<any | undefined> {
    let repo = await this._getRepo(forDirectory);

    let i = 0;
    while (!repo?.state?.HEAD?.name) {
      if (this._repoWasNone) return undefined;

      await new Promise((resolve) => setTimeout(resolve, 1000));
      i++;
      if (i >= 20) {
        this._repoWasNone = true;
        return undefined;
      }
      repo = await this._getRepo(forDirectory);
    }
    return repo;
  }

  async getGitRoot(forDirectory: string): Promise<string | undefined> {
    const repo = await this.getRepo(vscode.Uri.file(forDirectory));
    return repo?.rootUri?.fsPath;
  }

  async getBranch(forDirectory: vscode.Uri) {
    let repo = await this.getRepo(forDirectory);
    if (repo?.state?.HEAD?.name === undefined) {
      try {
        const { stdout } = await asyncExec("git rev-parse --abbrev-ref HEAD", {
          cwd: forDirectory.fsPath,
        });
        return stdout?.trim() || "NONE";
      } catch (e) {
        return "NONE";
      }
    }

    return repo?.state?.HEAD?.name || "NONE";
  }

  async getDiff(): Promise<string> {
    let diffs = [];

    for (const dir of this.getWorkspaceDirectories()) {
      const repo = await this.getRepo(vscode.Uri.file(dir));
      if (!repo) {
        continue;
      }

      diffs.push((await repo.getDiff()).join("\n"));
    }

    return diffs.join("\n\n");
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
}
