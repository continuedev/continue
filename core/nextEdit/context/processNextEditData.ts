import { IDE, Position } from "../..";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { RecentlyEditedRange } from "../types";
import { getAutocompleteContext } from "./autocompleteContextFetching";
import { createDiff, DiffFormatType } from "./diffFormatting";

export const processNextEditData = async (
  filePath: string,
  beforeContent: string,
  afterContent: string,
  cursorPosBeforeEdit: Position,
  cursorPosAfterPrevEdit: Position,
  ide: IDE,
  configHandler: ConfigHandler,
  getDefinitionsFromLsp: GetLspDefinitionsFunction,
  recentlyEditedRanges: RecentlyEditedRange[],
  recentlyVisitedRanges: AutocompleteCodeSnippet[],
  modelNameOrInstance?: string | undefined,
  // eslint-disable-next-line max-params
) => {
  const maxPromptTokens = 1024;

  // Get the actual configured autocomplete model - same as CompletionProvider
  const { config } = await configHandler.loadConfig();
  const autocompleteModel =
    (modelNameOrInstance || config?.selectedModelByRole.autocomplete) ??
    undefined;

  const modelName = "Codestral";

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

  console.log(
    createDiff(beforeContent, afterContent, filePath, DiffFormatType.Unified),
  );

  // console.log("ACCESSED PREFIX:\n", autocompleteContext);
  console.log("\n");
};
