import { IDE, RangeInFileWithContents } from "../index";
import { AutocompleteLanguageInfo } from "./constants/AutocompleteLanguageInfo";
import { AutocompleteCodeSnippet } from "./snippets/types";

/**
 * @deprecated This type should be removed in the future or renamed.
 * We have a new interface called AutocompleteSnippet which is more
 * general.
 */
export type AutocompleteSnippetDeprecated = RangeInFileWithContents & {
  score?: number;
};

export type GetLspDefinitionsFunction = (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
) => Promise<AutocompleteCodeSnippet[]>;
