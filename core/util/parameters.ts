import { TabAutocompleteOptions } from "../index.js";

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
  useOtherFiles: true,
  useRecentlyEdited: true,
  recentLinePrefixMatchMinLength: 7,
  disableInFiles: undefined,
};

export const COUNT_COMPLETION_REJECTED_AFTER = 10_000;
export const DO_NOT_COUNT_REJECTED_BEFORE = 250;

export const RETRIEVAL_PARAMS = {
  rerankThreshold: 0.3,
  nFinal: 10,
  nRetrieve: 20,
  bm25Threshold: -2.5,
};

// export const SERVER_URL = "http://localhost:3000";
export const SERVER_URL = "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app";
