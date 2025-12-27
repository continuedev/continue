import { z } from "zod";

export const clientCertificateOptionsSchema = z.object({
  cert: z.string(),
  key: z.string(),
  passphrase: z.string().optional(),
});
export type ClientCertificateOptions = z.infer<
  typeof clientCertificateOptionsSchema
>;

export const requestOptionsSchema = z.object({
  timeout: z.number().optional(),
  verifySsl: z.boolean().optional(),
  caBundlePath: z.union([z.string(), z.array(z.string())]).optional(),
  proxy: z.string().optional(),
  headers: z.record(z.string()).optional(),
  extraBodyProperties: z.record(z.any()).optional(),
  noProxy: z.array(z.string()).optional(),
  clientCertificate: clientCertificateOptionsSchema.optional(),
});
export type RequestOptions = z.infer<typeof requestOptionsSchema>;
export const modelRolesSchema = z.enum([
  "chat",
  "autocomplete",
  "embed",
  "rerank",
  "edit",
  "apply",
  "summarize",
  "subagent",
]);
export type ModelRole = z.infer<typeof modelRolesSchema>;

// TODO consider just using array of strings for model capabilities
// To allow more dynamic string parsing
export const modelCapabilitySchema = z.union([
  z.literal("tool_use"),
  z.literal("image_input"),
  z.literal("next_edit"),
  z.string(), // Needed for forwards compatibility, see https://github.com/continuedev/continue/pull/7676
]);

// not ideal but lose type suggestions if use z.infer because of the string fallback
export type ModelCapability = "tool_use" | "image_input" | "next_edit";

export const completionOptionsSchema = z.object({
  contextLength: z.number().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  minP: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  stop: z.array(z.string()).optional(),
  n: z.number().optional(),
  reasoning: z.boolean().optional(),
  reasoningBudgetTokens: z.number().optional(),
  promptCaching: z.boolean().optional(),
  stream: z.boolean().optional(),
});
export type CompletionOptions = z.infer<typeof completionOptionsSchema>;

export const embeddingTasksSchema = z.union([
  z.literal("chunk"),
  z.literal("query"),
]);
export type EmbeddingTasks = z.infer<typeof embeddingTasksSchema>;

export const embeddingPrefixesSchema = z.record(
  embeddingTasksSchema,
  z.string(),
);
export type EmbeddingPrefixes = z.infer<typeof embeddingPrefixesSchema>;

export const cacheBehaviorSchema = z.object({
  cacheSystemMessage: z.boolean().optional(),
  cacheConversation: z.boolean().optional(),
});
export type CacheBehavior = z.infer<typeof cacheBehaviorSchema>;

export const embedOptionsSchema = z.object({
  maxChunkSize: z.number().optional(),
  maxBatchSize: z.number().optional(),
  embeddingPrefixes: embeddingPrefixesSchema.optional(),
});
export type EmbedOptions = z.infer<typeof embedOptionsSchema>;

export const chatOptionsSchema = z.object({
  baseSystemMessage: z.string().optional(),
  baseAgentSystemMessage: z.string().optional(),
  basePlanSystemMessage: z.string().optional(),
});
export type ChatOptions = z.infer<typeof chatOptionsSchema>;

const templateSchema = z.enum([
  "llama2",
  "alpaca",
  "zephyr",
  "phi2",
  "phind",
  "anthropic",
  "chatml",
  "none",
  "openchat",
  "deepseek",
  "xwin-coder",
  "neural-chat",
  "codellama-70b",
  "llava",
  "gemma",
  "granite",
  "llama3",
  "codestral",
]);

export const autocompleteOptionsSchema = z.object({
  disable: z.boolean().optional(),
  maxPromptTokens: z.number().optional(),
  debounceDelay: z.number().optional(),
  modelTimeout: z.number().optional(),
  maxSuffixPercentage: z.number().optional(),
  prefixPercentage: z.number().optional(),
  transform: z.boolean().optional(),
  template: z.string().optional(),
  onlyMyCode: z.boolean().optional(),
  useCache: z.boolean().optional(),
  useImports: z.boolean().optional(),
  useRecentlyEdited: z.boolean().optional(),
  useRecentlyOpened: z.boolean().optional(),
  // Experimental options: true = enabled, false = disabled, number = enabled w priority
  experimental_includeClipboard: z.boolean().optional(),
  experimental_includeRecentlyVisitedRanges: z.boolean().optional(),
  experimental_includeRecentlyEditedRanges: z.boolean().optional(),
  experimental_includeDiff: z.boolean().optional(),
  experimental_enableStaticContextualization: z.boolean().optional(),
});

/** Prompt templates use Handlebars syntax */
const promptTemplatesSchema = z.object({
  apply: z.string().optional(),
  chat: templateSchema.optional(),
  edit: z.string().optional(),
  autocomplete: z.string().optional(),
});
export type PromptTemplates = z.infer<typeof promptTemplatesSchema>;

const baseModelFields = {
  name: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  maxStopWords: z.number().optional(),
  roles: modelRolesSchema.array().optional(),
  capabilities: modelCapabilitySchema.array().optional(),
  defaultCompletionOptions: completionOptionsSchema.optional(),
  cacheBehavior: cacheBehaviorSchema.optional(),
  requestOptions: requestOptionsSchema.optional(),
  embedOptions: embedOptionsSchema.optional(),
  chatOptions: chatOptionsSchema.optional(),
  promptTemplates: promptTemplatesSchema.optional(),
  useLegacyCompletionsEndpoint: z.boolean().optional(),
  env: z
    .record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
    .optional(),
  autocompleteOptions: autocompleteOptionsSchema.optional(),
};

export const modelSchema = z.union([
  z.object({
    ...baseModelFields,
    provider: z.literal("continue-proxy"),
    apiKeyLocation: z.string().optional(),
    envSecretLocations: z.record(z.string(), z.string()).optional(),
    orgScopeId: z.string().nullable(),
    onPremProxyUrl: z.string().nullable(),
  }),
  z.object({
    ...baseModelFields,
    provider: z.string().refine((val) => val !== "continue-proxy"),
    sourceFile: z.string().optional(),
  }),
]);

export const partialModelSchema = z.union([
  z
    .object({
      ...baseModelFields,
      provider: z.literal("continue-proxy"),
      apiKeyLocation: z.string().optional(),
      envSecretLocations: z.record(z.string(), z.string()).optional(),
    })
    .partial(),
  z
    .object({
      ...baseModelFields,
      provider: z.string().refine((val) => val !== "continue-proxy"),
    })
    .partial(),
]);

export type ModelConfig = z.infer<typeof modelSchema>;
