import { TabAutocompleteOptions } from "..";

export const DEFAULT_AUTOCOMPLETE_OPTS: TabAutocompleteOptions = {
  disable: false,
  useCopyBuffer: false,
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
  useOtherFiles: false,
};

export const RETRIEVAL_PARAMS = {
  rerankThreshold: 0.3,
  nFinal: 10,
  nRetrieve: 20,
  bm25Threshold: -2.5,
};

// export const SERVER_URL = "http://localhost:3000";
export const SERVER_URL = "https://proxy-server-green-l6vsfbzhba-uw.a.run.app";
