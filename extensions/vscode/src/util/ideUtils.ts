import { EXTENSION_NAME } from "core/control-plane/env";
import _ from "lodash";
import * as vscode from "vscode";
import * as URI from "uri-js";
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

import type { Range, RangeInFile, Thread } from "core";
import { findUriInDirs } from "core/util/uri";

const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

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
      await vscode.workspace.fs.stat(uri);
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
      .map((group) => {
        return group.tabs.map((tab) => {
          return (tab.input as any)?.uri;
        });
      })
      .flat()
      .filter(Boolean) // filter out undefined values
      .filter((uri) => this.documentIsCode(uri)); // Filter out undesired documents
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
    const contents = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(uri),
    );
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
