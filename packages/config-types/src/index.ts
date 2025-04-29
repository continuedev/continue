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
  useMmap: z.boolean().optional(),
  keepAlive: z.number().optional(),
  numGpu: z.number().optional(),
  raw: z.boolean().optional(),
  stream: z.boolean().optional(),
});
export type CompletionOptions = z.infer<typeof completionOptionsSchema>;

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
    "sagemaker",
    "cloudflare",
    "azure",
    "ovhcloud",
    "continue-proxy",
    "nebius",
    "scaleway",
    "watsonx"
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
export type ModelDescription = z.infer<typeof modelDescriptionSchema>;

export const embeddingsProviderSchema = z.object({
  provider: z.enum([
    "transformers.js",
    "ollama",
    "openai",
    "cohere",
    "free-trial",
    "gemini",
    "ovhcloud",
    "continue-proxy",
    "nebius",
    "scaleway",
    "watsonx"
  ]),
  apiBase: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  deployment: z.string().optional(),
  apiType: z.string().optional(),
  apiVersion: z.string().optional(),
  requestOptions: requestOptionsSchema.optional(),
});
export type EmbeddingsProvider = z.infer<typeof embeddingsProviderSchema>;

export const uiOptionsSchema = z.object({
  codeBlockToolbarPosition: z.enum(["top", "bottom"]).optional(),
  fontSize: z.number().optional(),
  displayRawMarkdown: z.boolean().optional(),
  showChatScrollbar: z.boolean().optional(),
  codeWrap: z.boolean().optional(),
});
export type UiOptions = z.infer<typeof uiOptionsSchema>;

export const tabAutocompleteOptionsSchema = z.object({
  disable: z.boolean(),
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
});
export type TabAutocompleteOptions = z.infer<
  typeof tabAutocompleteOptionsSchema
>;

export const slashCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  params: z.record(z.any()).optional(),
});
export type SlashCommand = z.infer<typeof slashCommandSchema>;

export const customCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  params: z.record(z.any()).optional(),
});
export type CustomCommand = z.infer<typeof customCommandSchema>;

export const contextProviderSchema = z.object({
  name: z.string(),
  params: z.record(z.string(), z.any()),
});
export type ContextProvider = z.infer<typeof contextProviderSchema>;

export const rerankerSchema = z.object({
  name: z.enum(["cohere", "voyage", "watsonx", "llm", "continue-proxy"]),
  params: z.record(z.any()).optional(),
});
export type Reranker = z.infer<typeof rerankerSchema>;

export const analyticsSchema = z.object({
  provider: z.enum([
    "posthog",
    "amplitude",
    "segment",
    "logstash",
    "mixpanel",
    "splunk",
    "datadog",
    "continue-proxy",
  ]),
  url: z.string().optional(),
  clientKey: z.string().optional(),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export const devDataSchema = z.object({
  url: z.string().optional(),
});
export type DevData = z.infer<typeof devDataSchema>;

export const siteIndexingConfigSchema = z.object({
  startUrl: z.string(),
  // rootUrl: z.string(),
  title: z.string(),
  maxDepth: z.string().optional(),
  faviconUrl: z.string().optional(),
  useLocalCrawling: z.boolean().optional(),
});

export const controlPlaneConfigSchema = z.object({
  useContinueForTeamsProxy: z.boolean().optional(),
  proxyUrl: z.string().optional(),
});

export const configJsonSchema = z.object({
  models: z.array(modelDescriptionSchema),
  tabAutocompleteModel: modelDescriptionSchema.optional(),
  embeddingsProvider: embeddingsProviderSchema.optional(),
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
  docs: z.array(siteIndexingConfigSchema).optional(),
  controlPlane: controlPlaneConfigSchema.optional(),
});
export type ConfigJson = z.infer<typeof configJsonSchema>;
