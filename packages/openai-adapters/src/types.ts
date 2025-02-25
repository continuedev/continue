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
    z.literal("fireworks"),
    z.literal("together"),
    z.literal("novita"),
    z.literal("nebius"),
    z.literal("function-network"),
    z.literal("llama.cpp"),
    z.literal("llamafile"),
    z.literal("lmstudio"),
    z.literal("cerebras"),
    z.literal("kindo"),
    z.literal("msty"),
    z.literal("openrouter"),
    z.literal("sambanova"),
    z.literal("text-gen-webui"),
    z.literal("vllm"),
    z.literal("x-ai"),
    z.literal("scaleway"),
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

// Other APIs
export const CohereConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("cohere"),
});
export type CohereConfig = z.infer<typeof CohereConfigSchema>;

export const AzureConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("azure"),
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

export const JinaConfigSchema = OpenAIConfigSchema.extend({
  provider: z.literal("jina"),
});
export type JinaConfig = z.infer<typeof JinaConfigSchema>;

// Discriminated union
export const LLMConfigSchema = z.discriminatedUnion("provider", [
  OpenAIConfigSchema,
  MoonshotConfigSchema,
  DeepseekConfigSchema,
  CohereConfigSchema,
  AzureConfigSchema,
  GeminiConfigSchema,
  AnthropicConfigSchema,
  JinaConfigSchema,
]);
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
