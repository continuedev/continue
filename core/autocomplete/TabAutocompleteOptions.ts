import { LanguageId } from "../util/languageId";

export interface TabAutocompleteLanguageOptions {
  enableRootPathSnippets: boolean;
  enableImportSnippets: boolean;
  enableDiffSnippets: boolean;
  enableClipboardSnippets: boolean;
  enableRecentlyEditedRangeSnippets: boolean;
  outlineNodeReplacements: { [key: string]: string };
  filterMaxRepeatingLines: number;
}

export interface TabAutocompleteOptions {
  disable: boolean;
  useFileSuffix: boolean;
  maxPromptTokens: number;
  debounceDelay: number;
  maxSuffixPercentage: number;
  prefixPercentage: number;
  transform?: boolean;
  template?: string;
  multilineCompletions: "always" | "never" | "auto";
  slidingWindowPrefixPercentage: number;
  slidingWindowSize: number;
  useCache: boolean;
  onlyMyCode: boolean;
  useRecentlyEdited: boolean;
  disableInFiles?: string[];
  logDisableInFiles: boolean;
  useImports?: boolean;
  showWhateverWeHaveAtXMs: number;
  logSnippetLimiting: boolean;
  logSnippetTimeouts: boolean;
  logOutlineCreation: boolean;
  logCompletionStop: boolean;

  logEmptySingleLineCommentFilter: boolean;

  logRootPathSnippets: boolean;
  logImportSnippets: boolean;
  logDiffSnippets: boolean;
  logClipboardSnippets: boolean;

  defaultLanguageOptions: TabAutocompleteLanguageOptions;
  languageOptions: {
    [languageId in LanguageId]?: TabAutocompleteLanguageOptions;
  };
}

export const DEFAULT_AUTOCOMPLETE_OPTS: TabAutocompleteOptions = {
  disable: false,
  useFileSuffix: true,
  maxPromptTokens: 1024,
  prefixPercentage: 0.3,
  maxSuffixPercentage: 0.2,
  debounceDelay: 350,
  multilineCompletions: "auto",
  // @deprecated TO BE REMOVED
  slidingWindowPrefixPercentage: 0.75,
  // @deprecated TO BE REMOVED
  slidingWindowSize: 500,
  useCache: true,
  onlyMyCode: true,
  useRecentlyEdited: true,
  disableInFiles: undefined,
  logDisableInFiles: false,
  useImports: true,
  transform: true,
  showWhateverWeHaveAtXMs: 300,
  logSnippetLimiting: false,
  logSnippetTimeouts: false,
  logOutlineCreation: false,

  logRootPathSnippets: false,
  logImportSnippets: false,
  logDiffSnippets: false,
  logClipboardSnippets: false,
  logCompletionStop: false,

  logEmptySingleLineCommentFilter: false,

  defaultLanguageOptions: {
    enableRootPathSnippets: true,
    enableImportSnippets: true,
    enableDiffSnippets: true,
    enableClipboardSnippets: true,
    enableRecentlyEditedRangeSnippets: true,
    outlineNodeReplacements: {
      statement_block: "{...}",
    },
    filterMaxRepeatingLines: 3,
  },
  languageOptions: {},
};
