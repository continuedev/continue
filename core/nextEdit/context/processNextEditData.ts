import { IDE, Position } from "../..";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { DataLogger } from "../../data/log";
import { RecentlyEditedRange } from "../types";
import { getAutocompleteContext } from "./autocompleteContextFetching";

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

  // console.log(
  //   createDiff(beforeContent, afterContent, filePath, DiffFormatType.Unified),
  // );

  void DataLogger.getInstance().logDevData({
    name: "nextEdit",
    data: {
      fileURI: filePath,
      workspaceDirURI: workspaceDir,
      beforeContent,
      afterContent,
      beforeCursorPos: cursorPosBeforeEdit,
      afterCursorPos: cursorPosAfterPrevEdit,
      context: autocompleteContext,
    },
  });
};
