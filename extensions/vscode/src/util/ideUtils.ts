import { EXTENSION_NAME } from "core/control-plane/env";
import { findUriInDirs } from "core/util/uri";
import _ from "lodash";
import * as URI from "uri-js";
import * as vscode from "vscode";

import { threadStopped } from "../debug/debug";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import { GitExtension, Repository } from "../otherExtensions/git";
import {
  SuggestionRanges,
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  showSuggestion as showSuggestionInEditor,
} from "../suggestions";

import { getUniqueId, openEditorAndRevealRange } from "./vscode";

import type { Range, Thread } from "core";

const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

const NO_FS_PROVIDER_ERROR = "ENOPRO";
const UNSUPPORTED_SCHEMES: Set<string> = new Set();

export class VsCodeIdeUtils {
  visibleMessages: Set<string> = new Set();

  async gotoDefinition(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      uri,
      position,
    );
    return locations;
  }

  async documentSymbol(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      uri,
    );
  }

  async references(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<vscode.Location[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      uri,
      position,
    );
  }

  async foldingRanges(uri: vscode.Uri): Promise<vscode.FoldingRange[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeFoldingRangeProvider",
      uri,
    );
  }

  private _workspaceDirectories: vscode.Uri[] | undefined = undefined;
  getWorkspaceDirectories(): vscode.Uri[] {
    if (this._workspaceDirectories === undefined) {
      this._workspaceDirectories =
        vscode.workspace.workspaceFolders?.map((folder) => folder.uri) || [];
    }

    return this._workspaceDirectories;
  }

  setWokspaceDirectories(dirs: vscode.Uri[] | undefined): void {
    this._workspaceDirectories = dirs;
  }

  getUniqueId() {
    return getUniqueId();
  }

  showSuggestion(uri: vscode.Uri, range: Range, suggestion: string) {
    showSuggestionInEditor(
      uri,
      new vscode.Range(
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character,
      ),
      suggestion,
    );
  }

  async openFile(uri: vscode.Uri, range?: vscode.Range) {
    // vscode has a builtin open/get open files
    return await openEditorAndRevealRange(
      uri,
      range,
      vscode.ViewColumn.One,
      false,
    );
  }

  async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      return (await this.stat(uri)) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Read the entire contents of a file from the given URI.
   * If there are unsaved changes in an open editor, returns those instead of the file on disk.
   *
   * @param uri - The URI of the file to read.
   * @param ignoreMissingProviders - Optional flag to ignore missing file system providers for unsupported schemes.
   *                                 Defaults to `true`.
   * @returns A promise that resolves to the file content as a `Uint8Array`, or `null` if the scheme is unsupported
   *          or the provider is missing and `ignoreMissingProviders` is `true`.
   *          If `ignoreMissingProviders` is `false`, it will throw an error for unsupported schemes or missing providers.
   * @throws Will rethrow any error that is not related to missing providers or unsupported schemes.
   */
  async readFile(
    uri: vscode.Uri,
    ignoreMissingProviders: boolean = true,
  ): Promise<Uint8Array | null> {
    // First check if there's an open document with this URI that might have unsaved changes.
    const openDocuments = vscode.workspace.textDocuments;
    for (const document of openDocuments) {
      if (document.uri.toString() === uri.toString()) {
        // Found an open document with this URI.
        // Return its current content (including any unsaved changes) as Uint8Array.
        const docText = document.getText();
        return Buffer.from(docText, "utf8");
      }
    }

    // If no open document found or if it's not dirty, fall back to reading from disk.
    return await this.fsOperation(
      uri,
      async (u) => {
        return await vscode.workspace.fs.readFile(u);
      },
      ignoreMissingProviders,
    );
  }

  /**
   * Retrieve metadata about a file from the given URI.
   *
   * @param uri - The URI of the file or directory to retrieve metadata about.
   * @param ignoreMissingProviders - Optional. If `true`, missing file system providers will be ignored. Defaults to `true`.
   * @returns A promise that resolves to a `vscode.FileStat` object containing the file metadata,
   *          or `null` if the scheme is unsupported or the provider is missing and `ignoreMissingProviders` is `true`.
   */
  async stat(
    uri: vscode.Uri,
    ignoreMissingProviders: boolean = true,
  ): Promise<vscode.FileStat | null> {
    return await this.fsOperation(
      uri,
      async (u) => {
        return await vscode.workspace.fs.stat(uri);
      },
      ignoreMissingProviders,
    );
  }

  /**
   * Retrieve all entries of a directory from the given URI.
   *
   * @param uri - The URI of the directory to read.
   * @param ignoreMissingProviders - Optional. If `true`, missing file system providers will be ignored. Defaults to `true`.
   * @returns A promise that resolves to an array of tuples, where each tuple contains the name of a directory entry
   *          and its type (`vscode.FileType`), or `null` if the scheme is unsupported or the provider is missing and `ignoreMissingProviders` is `true`.
   */
  async readDirectory(
    uri: vscode.Uri,
    ignoreMissingProviders: boolean = true,
  ): Promise<[string, vscode.FileType][] | null> {
    return await this.fsOperation(
      uri,
      async (u) => {
        return await vscode.workspace.fs.readDirectory(uri);
      },
      ignoreMissingProviders,
    );
  }

  /**
   * Performs a file system operation on the given URI using the provided delegate function.
   *
   * @template T The type of the result returned by the delegate function.
   * @param uri The URI on which the file system operation is to be performed.
   * @param delegate A function that performs the desired operation on the given URI.
   * @param ignoreMissingProviders Whether to ignore errors caused by missing file system providers. Defaults to `true`.
   * @returns A promise that resolves to the result of the delegate function, or `null` if the operation is skipped due to unsupported schemes or missing providers.
   * @throws Re-throws any error encountered during the operation, except for missing provider errors when `ignoreMissingProviders` is `true`.
   */
  private async fsOperation<T>(
    uri: vscode.Uri,
    delegate: (uri: vscode.Uri) => T,
    ignoreMissingProviders: boolean = true,
  ): Promise<T | null> {
    const scheme = uri.scheme;
    if (ignoreMissingProviders && UNSUPPORTED_SCHEMES.has(scheme)) {
      return null;
    }
    try {
      return await delegate(uri);
    } catch (err: any) {
      if (
        ignoreMissingProviders &&
        //see https://github.com/microsoft/vscode/blob/c9c54f9e775e5f57d97bef796797b5bc670c8150/src/vs/workbench/api/common/extHostFileSystemConsumer.ts#L230
        (err.name === NO_FS_PROVIDER_ERROR ||
          err.message?.includes(NO_FS_PROVIDER_ERROR))
      ) {
        UNSUPPORTED_SCHEMES.add(scheme);
        console.log(`Ignoring missing provider error:`, err.message);
        return null;
      }
      throw err;
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

  async getUserSecret(key: string) {
    // Check if secret already exists in VS Code settings (global)
    let secret = vscode.workspace.getConfiguration(EXTENSION_NAME).get(key);
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
      .getConfiguration(EXTENSION_NAME)
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
  private documentIsCode(uri: vscode.Uri) {
    return uri.scheme === "file" || uri.scheme === "vscode-remote";
  }

  getOpenFiles(): vscode.Uri[] {
    return vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) =>
          tab.input instanceof vscode.TabInputText &&
          this.documentIsCode((tab.input as vscode.TabInputText).uri),
      )
      .map((tab) => (tab.input as vscode.TabInputText).uri);
  }

  saveFile(uri: vscode.Uri) {
    vscode.window.visibleTextEditors
      .filter((editor) => this.documentIsCode(editor.document.uri))
      .forEach((editor) => {
        if (URI.equal(editor.document.uri.toString(), uri.toString())) {
          editor.document.save();
        }
      });
  }

  async readRangeInFile(uri: vscode.Uri, range: vscode.Range): Promise<string> {
    const buffer = await this.readFile(uri);
    if (buffer === null) {
      return "";
    }
    const contents = new TextDecoder().decode(buffer);
    const lines = contents.split("\n");
    return `${lines
      .slice(range.start.line, range.end.line)
      .join("\n")}\n${lines[
      range.end.line < lines.length - 1 ? range.end.line : lines.length - 1
    ].slice(0, range.end.character)}`;
  }

  async getTerminalContents(commands = -1): Promise<string> {
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
    let terminalContents = (await vscode.env.clipboard.readText()).trim();
    await vscode.env.clipboard.writeText(tempCopyBuffer);

    if (tempCopyBuffer === terminalContents) {
      // This means there is no terminal open to select text from
      return "";
    }

    // Sometimes the above won't successfully separate by command, so we attempt manually
    const lines = terminalContents.split("\n");
    const lastLine = lines.pop()?.trim();
    if (lastLine) {
      let i = lines.length - 1;
      while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
        i--;
      }
      terminalContents = lines.slice(Math.max(i, 0)).join("\n");
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
    if (!session) {
      return [];
    }

    const threadsResponse = await this._getThreads(session);
    return threadsResponse.threads;
  }

  async getDebugLocals(threadIndex = 0): Promise<string> {
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
    stackDepth = 3,
  ): Promise<string[]> {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
      return [];
    }

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

            return await this.retrieveSource(
              scope.source && !_.isEmpty(scope.source) ? scope : stackFrame,
            );
          }),
      );

    return Promise.all(sourcesPromises);
  }

  private async retrieveSource(sourceContainer: any): Promise<string> {
    if (!sourceContainer.source) {
      return "";
    }

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
    } else if (sourceContainer.line) {
      // fall back to 5 line of context
      return await this.readRangeInFile(
        sourceContainer.source.path,
        new vscode.Range(
          Math.max(0, sourceContainer.line - 3),
          0,
          sourceContainer.line + 2,
          0,
        ),
      );
    } else {
      return "unavailable";
    }
  }

  private async _getRepo(
    forDirectory: vscode.Uri,
  ): Promise<Repository | undefined> {
    // Use the native git extension to get the branch name
    const extension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (
      typeof extension === "undefined" ||
      !extension.isActive ||
      typeof vscode.workspace.workspaceFolders === "undefined"
    ) {
      return undefined;
    }

    try {
      const git = extension.exports.getAPI(1);
      return git.getRepository(forDirectory) ?? undefined;
    } catch (e) {
      this._repoWasNone = true;
      console.warn("Git not found: ", e);
      return undefined;
    }
  }

  private _getRepositories(): Repository[] | undefined {
    const extension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (
      typeof extension === "undefined" ||
      !extension.isActive ||
      typeof vscode.workspace.workspaceFolders === "undefined"
    ) {
      return undefined;
    }

    try {
      const git = extension.exports.getAPI(1);
      return git.repositories;
    } catch (e) {
      this._repoWasNone = true;
      console.warn("Git not found: ", e);
      return undefined;
    }
  }

  private _repoWasNone: boolean = false;
  private repoCache: Map<string, Repository> = new Map();
  private static secondsToWaitForGitToLoad =
    process.env.NODE_ENV === "test" ? 1 : 20;
  async getRepo(forDirectory: vscode.Uri): Promise<Repository | undefined> {
    const workspaceDirs = this.getWorkspaceDirectories().map((dir) =>
      dir.toString(),
    );
    const { foundInDir } = findUriInDirs(
      forDirectory.toString(),
      workspaceDirs,
    );
    if (foundInDir) {
      // Check if the repository is already cached
      const cachedRepo = this.repoCache.get(foundInDir);
      if (cachedRepo) {
        return cachedRepo;
      }
    }

    let repo = await this._getRepo(forDirectory);

    let i = 0;
    while (!repo?.state?.HEAD?.name) {
      if (this._repoWasNone) {
        return undefined;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      i++;
      if (i >= VsCodeIdeUtils.secondsToWaitForGitToLoad) {
        this._repoWasNone = true;
        return undefined;
      }
      repo = await this._getRepo(forDirectory);
    }

    if (foundInDir) {
      // Cache the repository for the parent directory
      this.repoCache.set(foundInDir, repo);
    }

    return repo;
  }

  async getGitRoot(forDirectory: vscode.Uri): Promise<vscode.Uri | undefined> {
    const repo = await this.getRepo(forDirectory);
    return repo?.rootUri;
  }

  async getBranch(forDirectory: vscode.Uri) {
    const repo = await this.getRepo(forDirectory);
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

  private splitDiff(diffString: string): string[] {
    const fileDiffHeaderRegex = /(?=diff --git a\/.* b\/.*)/;

    const diffs = diffString.split(fileDiffHeaderRegex);

    if (diffs[0].trim() === "") {
      diffs.shift();
    }

    return diffs;
  }

  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    const diffs: string[] = [];

    const repos = this._getRepositories();

    try {
      if (repos) {
        for (const repo of repos) {
          const staged = await repo.diff(true);

          diffs.push(staged);
          if (includeUnstaged) {
            const unstaged = await repo.diff(false);
            diffs.push(unstaged);
          }
        }
      }

      return diffs.flatMap((diff) => this.splitDiff(diff));
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}
