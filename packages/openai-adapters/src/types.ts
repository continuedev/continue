import * as z from "zod";

export const ClientCertificateOptionsSchema = z.object({
  cert: z.string(),
  key: z.string(),
  passphrase: z.string().optional(),
});

export const RequestOptionsSchema = z.object({
  timeout: z.number().optional(),
  verifySsl: z.boolean().optional(),
  caBundlePath: z.union([z.string(), z.array(z.string())]).optional(),
  proxy: z.string().optional(),
  headers: z.record(z.string()).optional(),
  extraBodyProperties: z.record(z.unknown()).optional(),
  noProxy: z.array(z.string()).optional(),
  clientCertificate: z.lazy(() => ClientCertificateOptionsSchema).optional(),
});

// Base config objects
export const BaseConfig = z.object({
  provider: z.string(),
  requestOptions: RequestOptionsSchema.optional(),
});

export const BasePlusConfig = BaseConfig.extend({
  apiBase: z.string().optional(),
  apiKey: z.string().optional(),
});

// OpenAI and compatible
export const OpenAIConfigSchema = BasePlusConfig.extend({
  provider: z.union([
    z.literal("openai"),
    z.literal("mistral"),
    z.literal("voyage"),
    z.literal("deepinfra"),
    z.literal("groq"),
    z.literal("nvidia"),
    z.literal("ovhcloud"),
    z.literal("fireworks"),
    z.literal("together"),
    z.literal("novita"),
    z.literal("nebius"),
    z.literal("function-network"),
    z.literal("llama.cpp"),
    z.literal("llamafile"),
    z.literal("lmstudio"),
    z.literal("ollama"),
    z.literal("cerebras"),
    z.literal("kindo"),
    z.literal("msty"),
    z.literal("openrouter"),
    z.literal("sambanova"),
    z.literal("text-gen-webui"),
    z.literal("vllm"),
    z.literal("xAI"),
    z.literal("scaleway"),
    z.literal("ncompass"),
    z.literal("relace"),
    z.literal("huggingface-inference-api"),
  ]),
});
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

export const MoonshotConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("moonshot"),
});
export type MoonshotConfig = z.infer<typeof MoonshotConfigSchema>;

export const DeepseekConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("deepseek"),
});
export type DeepseekConfig = z.infer<typeof DeepseekConfigSchema>;

export const BedrockConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("bedrock"),
  // cacheBehavior: z.object({
  //   cacheSystemMessage: z.boolean().optional(),
  //   cacheConversation: z.boolean().optional(),
  // }).optional(),
  env: z
    .object({
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      profile: z.string().optional(),
    })
    .optional(),
});
export type BedrockConfig = z.infer<typeof BedrockConfigSchema>;

export const LlamastackConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("llamastack"),
});
export type LlamastackConfig = z.infer<typeof LlamastackConfigSchema>;

export const ContinueProxyConfigSchema = BasePlusConfig.extend({
  provider: z.literal("continue-proxy"),
  env: z.object({
    apiKeyLocation: z.string().optional(),
    envSecretLocations: z.record(z.string(), z.string()).optional(),
    orgScopeId: z.string().nullable(),
    proxyUrl: z.string().optional(),
  }),
});
export type ContinueProxyConfig = z.infer<typeof ContinueProxyConfigSchema>;

export const MockConfigSchema = BasePlusConfig.extend({
  provider: z.literal("mock"),
});

export type MockConfig = z.infer<typeof MockConfigSchema>;

// Other APIs
export const CohereConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("cohere"),
});
export type CohereConfig = z.infer<typeof CohereConfigSchema>;

export const CometAPIConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("cometapi"),
});
export type CometAPIConfig = z.infer<typeof CometAPIConfigSchema>;

export const AskSageConfigSchema = BasePlusConfig.extend({
  provider: z.literal("askSage"),
  env: z
    .object({
      email: z.string().optional(),
      userApiUrl: z.string().optional(),
    })
    .optional(),
});
export type AskSageConfig = z.infer<typeof AskSageConfigSchema>;

export const AzureConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("azure"),
  env: z
    .object({
      apiVersion: z.string().optional(),
      apiType: z
        .union([
          z.literal("azure-foundry"),
          z.literal("azure-openai"),
          z.literal("azure"), // Legacy
        ])
        .optional(),
      deployment: z.string().optional(),
    })
    .optional(),
});
export type AzureConfig = z.infer<typeof AzureConfigSchema>;

export const GeminiConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("gemini"),
  apiKey: z.string(),
});
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

export const AnthropicConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("anthropic"),
  apiKey: z.string(),
});
export type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>;

export const WatsonXConfigSchema = BasePlusConfig.extend({
  provider: z.literal("watsonx"),
  apiKey: z.string(),
  env: z.object({
    apiVersion: z.string().optional(),
    projectId: z.string().optional(),
    deploymentId: z.string().optional(),
  }),
});
export type WatsonXConfig = z.infer<typeof WatsonXConfigSchema>;

export const JinaConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("jina"),
});
export type JinaConfig = z.infer<typeof JinaConfigSchema>;

export const InceptionConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("inception"),
});
export type InceptionConfig = z.infer<typeof InceptionConfigSchema>;

export const VertexAIConfigSchema = BasePlusConfig.extend({
  provider: z.literal("vertexai"),
  env: z
    .object({
      region: z.string().optional(),
      projectId: z.string().optional(),
      keyFile: z.string().optional(),
      keyJson: z.string().optional(),
    })
    .optional(),
});
export type VertexAIConfig = z.infer<typeof VertexAIConfigSchema>;

// Discriminated union
export const LLMConfigSchema = z.discriminatedUnion("provider", [
  OpenAIConfigSchema,
  BedrockConfigSchema,
  MoonshotConfigSchema,
  DeepseekConfigSchema,
  CohereConfigSchema,
  AzureConfigSchema,
  GeminiConfigSchema,
  AnthropicConfigSchema,
  WatsonXConfigSchema,
  JinaConfigSchema,
  MockConfigSchema,
  InceptionConfigSchema,
  VertexAIConfigSchema,
  LlamastackConfigSchema,
  ContinueProxyConfigSchema,
  CometAPIConfigSchema,
  AskSageConfigSchema,
]);
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
