import { z } from "zod";

export const completionOptionsSchema = z.object({
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  minP: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  mirostat: z.number().optional(),
  stop: z.array(z.string()).optional(),
  maxTokens: z.number().optional(),
  numThreads: z.number().optional(),
  keepAlive: z.number().optional(),
  raw: z.boolean().optional(),
  stream: z.boolean().optional(),
});

export const requestOptionsSchema = z.object({
  timeout: z.number().optional(),
  verifySsl: z.boolean().optional(),
  caBundlePath: z.union([z.string(), z.array(z.string())]).optional(),
  proxy: z.string().optional(),
  headers: z.record(z.string()).optional(),
  extraBodyProperties: z.record(z.any()).optional(),
  noProxy: z.array(z.string()).optional(),
});

export const modelDescriptionSchema = z.object({
  title: z.string(),
  provider: z.enum([
    "openai",
    "anthropic",
    "cohere",
    "ollama",
    "huggingface-tgi",
    "huggingface-inference-api",
    "replicate",
    "gemini",
    "mistral",
    "bedrock",
    "cloudflare",
    "azure",
  ]),
  model: z.string(),
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  contextLength: z.number().optional(),
  template: z
    .enum([
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
      "llama3",
    ])
    .optional(),
  completionOptions: completionOptionsSchema.optional(),
  systemMessage: z.string().optional(),
  requestOptions: z
    .object({
      timeout: z.number().optional(),
      verifySsl: z.boolean().optional(),
      caBundlePath: z.union([z.string(), z.array(z.string())]).optional(),
      proxy: z.string().optional(),
      headers: z.record(z.string()).optional(),
      extraBodyProperties: z.record(z.any()).optional(),
      noProxy: z.array(z.string()).optional(),
    })
    .optional(),
  promptTemplates: z.record(z.string()).optional(),
});

export const embeddingsProviderSchema = z.object({
  provider: z.enum([
    "transformers.js",
    "ollama",
    "openai",
    "cohere",
    "free-trial",
    "gemini",
  ]),
  apiBase: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  engine: z.string().optional(),
  apiType: z.string().optional(),
  apiVersion: z.string().optional(),
  requestOptions: requestOptionsSchema.optional(),
});

export const uiOptionsSchema = z.object({
  codeBlockToolbarPosition: z.enum(["top", "bottom"]).optional(),
  fontSize: z.number().optional(),
  displayRawMarkdown: z.boolean().optional(),
});

export const tabAutocompleteOptionsSchema = z.object({
  disable: z.boolean(),
  useCopyBuffer: z.boolean(),
  useSuffix: z.boolean(),
  maxPromptTokens: z.number(),
  debounceDelay: z.number(),
  maxSuffixPercentage: z.number(),
  prefixPercentage: z.number(),
  template: z.string().optional(),
  multilineCompletions: z.enum(["always", "never", "auto"]),
  slidingWindowPrefixPercentage: z.number(),
  slidingWindowSize: z.number(),
  maxSnippetPercentage: z.number(),
  recentlyEditedSimilarityThreshold: z.number(),
  useCache: z.boolean(),
  onlyMyCode: z.boolean(),
  useOtherFiles: z.boolean(),
  useRecentlyEdited: z.boolean(),
  recentLinePrefixMatchMinLength: z.number(),
  disableInFiles: z.array(z.string()).optional(),
  useImports: z.boolean().optional(),
});

export const slashCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  params: z.record(z.any()).optional(),
});

export const customCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  params: z.record(z.any()).optional(),
});

export const contextProviderSchema = z.object({
  name: z.string(),
  params: z.record(z.string(), z.any()),
});

export const rerankerSchema = z.object({
  name: z.enum(["cohere", "voyage", "llm"]),
  params: z.record(z.any()).optional(),
});

export const analyticsSchema = z.object({
  url: z.string().optional(),
  clientKey: z.string().optional(),
});

export const devDataSchema = z.object({
  url: z.string().optional(),
});

export const configJsonSchema = z.object({
  models: z.array(modelDescriptionSchema),
  tabAutocompleteModel: modelDescriptionSchema.optional(),
  embeddingsModel: embeddingsProviderSchema.optional(),
  reranker: rerankerSchema.optional(),
  analytics: analyticsSchema,
  devData: devDataSchema,
  allowAnonymousTelemetry: z.boolean().optional(),
  systemMessage: z.string().optional(),
  completionOptions: completionOptionsSchema.optional(),
  requestOptions: requestOptionsSchema.optional(),
  slashCommands: z.array(slashCommandSchema).optional(),
  customCommands: z.array(customCommandSchema).optional(),
  contextProviders: z.array(contextProviderSchema).optional(),
  disableIndexing: z.boolean().optional(),
  tabAutocompleteOptions: tabAutocompleteOptionsSchema.optional(),
  ui: uiOptionsSchema.optional(),
});

export type ConfigJson = z.infer<typeof configJsonSchema>;
