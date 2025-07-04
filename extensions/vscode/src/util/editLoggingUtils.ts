import { IDE, Position, Range, RangeInFileWithNextEditInfo } from "core";
import { AutocompleteCodeSnippet } from "core/autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "core/autocomplete/types";
import { ConfigHandler } from "core/config/ConfigHandler";
import { RecentlyEditedRange } from "core/nextEdit/types";
import * as vscode from "vscode";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";

export const getBeforeCursorPos = (range: Range, activePos: Position) => {
  // whichever side of the range isn't active is the before position
  if (
    range.start.line === activePos.line &&
    range.start.character === activePos.character
  ) {
    return range.end as Position;
  } else {
    return range.start as Position;
  }
};

const getWorkspaceDirInfo = async (
  event: vscode.TextDocumentChangeEvent,
  ide: IDE,
) => {
  // gets the workspace dir uri and checks if it's the open-source continue repo
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    event.document.uri,
  );
  if (!workspaceFolder) {
    return false;
  }
  const workspaceDirUri = workspaceFolder.uri.toString();
  const repoName = await ide.getRepoName(workspaceDirUri);
  return {
    workspaceDirUri: workspaceDirUri,
    isContinueRepo: repoName === "continuedev/continue",
  };
};

export const handleTextDocumentChange = async (
  event: vscode.TextDocumentChangeEvent,
  configHandler: ConfigHandler,
  ide: IDE,
  completionProvider: ContinueCompletionProvider,
  getDefinitionsFromLsp: GetLspDefinitionsFunction,
) => {
  const changes = event.contentChanges;
  const editor = vscode.window.activeTextEditor;
  const { config } = await configHandler.loadConfig();

  if (!config?.experimental?.logEditingData) return;
  if (!editor) return;
  if (event.contentChanges.length === 0) return;

  // Ensure that loggin will only happen in the open-source continue repo
  const workspaceDirInfo = await getWorkspaceDirInfo(event, ide);
  if (!workspaceDirInfo) return;
  // if (!workspaceDirInfo.isContinueRepo) return;

  const activeCursorPos = editor.selection.active;
  const editActions: RangeInFileWithNextEditInfo[] = changes.map((change) => ({
    filepath: event.document.uri.toString(),
    range: {
      start: change.range.start as Position,
      end: change.range.end as Position,
    },
    fileContents: event.document.getText(),
    editText: change.text,
    beforeCursorPos: getBeforeCursorPos(change.range, activeCursorPos),
    afterCursorPos: activeCursorPos as Position,
    workspaceDir: workspaceDirInfo.workspaceDirUri,
  }));

  let recentlyEditedRanges: RecentlyEditedRange[] = [];
  let recentlyVisitedRanges: AutocompleteCodeSnippet[] = [];

  if (completionProvider) {
    recentlyEditedRanges =
      await completionProvider.recentlyEditedTracker.getRecentlyEditedRanges();
    recentlyVisitedRanges =
      completionProvider.recentlyVisitedRanges.getSnippets();
  }

  return {
    actions: editActions,
    configHandler: configHandler,
    getDefsFromLspFunction: getDefinitionsFromLsp,
    recentlyEditedRanges,
    recentlyVisitedRanges,
  };
};
