import { IDE, Position } from "../..";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { RecentlyEditedRange } from "../types";
import { getAutocompleteContext } from "./autocompleteContextFetching";
import { createDiff, DiffFormatType } from "./diffFormatting";

const randomNumberBetween = (min: number, max: number) => {
  min = Math.ceil(min); // Ensure min is an integer
  max = Math.floor(max); // Ensure max is an integer
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

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
  // To switch to the user's autocomplete model, uncomment the following lines
  // const { config } = await configHandler.loadConfig();
  // const autocompleteModel =
  //   (modelNameOrInstance || config?.selectedModelByRole.autocomplete) ??
  //   undefined;

  const modelName = "Codestral";

  const maxPromptTokens = randomNumberBetween(500, 14000);

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
};
