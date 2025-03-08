import { autocompleteEventAllSchema } from "./index.js";

export const autocompleteEventSchema_0_1_0 = autocompleteEventAllSchema.pick({
  disable: true,
  useFileSuffix: true,
  maxPromptTokens: true,
  debounceDelay: true,
  maxSuffixPercentage: true,
  prefixPercentage: true,
  transform: true,
  template: true,
  multilineCompletions: true,
  slidingWindowPrefixPercentage: true,
  slidingWindowSize: true,
  useCache: true,
  onlyMyCode: true,
  useRecentlyEdited: true,
  disableInFiles: true,
  useImports: true,
  accepted: true,
  time: true,
  prefix: true,
  suffix: true,
  prompt: true,
  completion: true,
  modelProvider: true,
  modelName: true,
  completionOptions: true,
  cacheHit: true,
  filepath: true,
  gitRepo: true,
  completionId: true,
  uniqueId: true,
  timestamp: true,
});

export const autocompleteEventSchema_0_1_0_noCode =
  autocompleteEventSchema_0_1_0.omit({
    prefix: true,
    suffix: true,
    prompt: true,
    completion: true,
  });
