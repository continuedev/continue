import { IDE, Position } from "../..";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { DataLogger } from "../../data/log";
import { NextEditProvider } from "../NextEditProvider";
import { RecentlyEditedRange } from "../types";
import { getAutocompleteContext } from "./autocompleteContextFetching";
import { createDiff, DiffFormatType } from "./diffFormatting";
import {
  getPrevEditsDescending,
  prevEdit,
  prevEditLruCache,
  setPrevEdit,
} from "./prevEditLruCache";

const randomNumberBetween = (min: number, max: number) => {
  min = Math.ceil(min); // Ensure min is an integer
  max = Math.floor(max); // Ensure max is an integer
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

interface ProcessNextEditDataParams {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  cursorPosBeforeEdit: Position;
  cursorPosAfterPrevEdit: Position;
  ide: IDE;
  configHandler: ConfigHandler;
  getDefinitionsFromLsp: GetLspDefinitionsFunction;
  recentlyEditedRanges: RecentlyEditedRange[];
  recentlyVisitedRanges: AutocompleteCodeSnippet[];
  workspaceDir: string;
  modelNameOrInstance?: string | undefined;
}

interface filenameAndDiff {
  filename: string;
  diff: string;
}

export const processNextEditData = async ({
  filePath,
  beforeContent,
  afterContent,
  cursorPosBeforeEdit,
  cursorPosAfterPrevEdit,
  ide,
  configHandler,
  getDefinitionsFromLsp,
  recentlyEditedRanges,
  recentlyVisitedRanges,
  workspaceDir,
  modelNameOrInstance,
}: ProcessNextEditDataParams) => {
  // To switch to the user's autocomplete model, uncomment the following lines
  // const { config } = await configHandler.loadConfig();
  // const autocompleteModel =
  //   (modelNameOrInstance || config?.selectedModelByRole.autocomplete) ??
  //   undefined;

  const modelName = "Codestral";
  const modelProvider = "mistral";
  const maxPromptTokens = randomNumberBetween(500, 12000);

  const autocompleteContext = await getAutocompleteContext(
    filePath,
    cursorPosBeforeEdit,
    ide,
    configHandler,
    getDefinitionsFromLsp,
    recentlyEditedRanges,
    recentlyVisitedRanges,
    maxPromptTokens,
    beforeContent,
    modelName,
  );

  NextEditProvider.getInstance().addAutocompleteContext(autocompleteContext);

  // console.log(
  //   createDiff(beforeContent, afterContent, filePath, DiffFormatType.Unified),
  // );

  let filenamesAndDiffs: filenameAndDiff[] = [];

  const timestamp = Date.now();
  let prevEdits: prevEdit[] = getPrevEditsDescending(); // edits from most to least recent
  if (prevEdits.length > 0) {
    // if last edit was 10+ minutes ago or the workspace changed, forget previous edits
    if (
      timestamp - prevEdits[0].timestamp >= 1000 * 60 * 10 ||
      workspaceDir !== prevEdits[0].workspaceUri
    ) {
      prevEditLruCache.clear();
      prevEdits = [];
    }

    // extract filenames and diffs for logging
    filenamesAndDiffs = prevEdits.map(
      (edit) =>
        ({
          // filename relative to workspace dir
          filename: edit.fileUri
            .replace(edit.workspaceUri, "")
            .replace(/^[/\\]/, ""),

          // diff without the first 4 lines (the file header)
          diff: edit.unidiff.split("\n").slice(4).join("\n"),
        }) as filenameAndDiff,
    );
  }

  if (filenamesAndDiffs.length > 0) {
    // if there are previous edits, log
    void DataLogger.getInstance().logDevData({
      name: "nextEditWithHistory",
      data: {
        previousEdits: filenamesAndDiffs,
        fileURI: filePath,
        workspaceDirURI: workspaceDir,
        beforeContent,
        afterContent,
        beforeCursorPos: cursorPosBeforeEdit,
        afterCursorPos: cursorPosAfterPrevEdit,
        context: autocompleteContext,
        modelProvider,
        modelName,
        modelTitle: modelName,
      },
    });
  }

  // add current edit to history
  const thisEdit: prevEdit = {
    unidiff: createDiff({
      beforeContent: beforeContent,
      afterContent: afterContent,
      filePath: filePath,
      diffType: DiffFormatType.Unified,
      contextLines: 25, // storing many context lines for downstream trimming
      workspaceDir: workspaceDir,
    }),
    fileUri: filePath,
    workspaceUri: workspaceDir,
    timestamp: timestamp,
  };

  setPrevEdit(thisEdit);
};
