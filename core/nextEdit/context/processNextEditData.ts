import { IDE, Position } from "../..";
import { AutocompleteCodeSnippet } from "../../autocomplete/snippets/types";
import { GetLspDefinitionsFunction } from "../../autocomplete/types";
import { ConfigHandler } from "../../config/ConfigHandler";
import { RecentlyEditedRange } from "../types";
import { getAutocompleteContext } from "./autocompleteContextFetching";

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
  // eslint-disable-next-line max-params
) => {
  const maxPromptTokens = 1024;

  // Get the actual configured autocomplete model - same as CompletionProvider
  const { config } = await configHandler.loadConfig();
  const autocompleteModel =
    config?.selectedModelByRole.autocomplete ?? undefined;
  console.log(autocompleteModel);

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
    autocompleteModel,
  );

  console.log("ACCESSED PREFIX:", autocompleteContext);
  console.log("\n");
};
