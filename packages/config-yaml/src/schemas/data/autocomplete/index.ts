import { z } from "zod";

export const autocompleteEventAllSchema = z.object({
  // Tab autocomplete options - TODO - old json version?
  disable: z.boolean(),
  useFileSuffix: z.boolean(),
  maxPromptTokens: z.number(),
  debounceDelay: z.number(),
  maxSuffixPercentage: z.number(),
  prefixPercentage: z.number(),
  transform: z.boolean().optional(),
  template: z.string().optional(),
  multilineCompletions: z.enum(["always", "never", "auto"]),
  slidingWindowPrefixPercentage: z.number(),
  slidingWindowSize: z.number(),
  useCache: z.boolean(),
  onlyMyCode: z.boolean(),
  useRecentlyEdited: z.boolean(),
  disableInFiles: z.array(z.string()).optional(),
  useImports: z.boolean().optional(),

  // Other
  accepted: z.boolean().optional(),
  time: z.number(),
  prefix: z.string(),
  suffix: z.string(),
  prompt: z.string(),
  completion: z.string(),
  modelProvider: z.string(),
  modelName: z.string(),
  completionOptions: z.object({}),
  cacheHit: z.boolean(),
  filepath: z.string(),
  gitRepo: z.string().optional(),
  completionId: z.string(),
  uniqueId: z.string(),
  timestamp: z.number(),
});
