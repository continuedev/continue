import { TabAutocompleteOptions } from "..";

export const DEFAULT_AUTOCOMPLETE_OPTS: TabAutocompleteOptions = {
  useCopyBuffer: true,
  useSuffix: true,
  maxPromptTokens: 650,
  prefixPercentage: 0.85,
  maxSuffixPercentage: 0.25,
  debounceDelay: 350,
};
