import { TabAutocompleteOptions } from "..";

export const DEFAULT_AUTOCOMPLETE_OPTS: TabAutocompleteOptions = {
  useCopyBuffer: true,
  useSuffix: true,
  maxPromptTokens: 500,
  prefixPercentage: 0.85,
  maxSuffixPercentage: 0.25,
  debounceDelay: 350,
  multilineCompletions: "auto",
  slidingWindowPrefixPercentage: 0.75,
  slidingWindowSize: 500,
  maxSnippetPercentage: 0.6,
  recentlyEditedSimilarityThreshold: 0.3,
  useCache: true,
  onlyMyCode: true,
};
