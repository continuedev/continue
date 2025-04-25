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
]);
export type ModelRole = z.infer<typeof modelRolesSchema>;

// TODO consider just using array of strings for model capabilities
// To allow more dynamic string parsing
export const modelCapabilitySchema = z.union([
  z.literal("tool_use"),
  z.literal("image_input"),
]);
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;

export const completionOptionsSchema = z.object({
  contextLength: z.number().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  stop: z.array(z.string()).optional(),
  n: z.number().optional(),
});
export type CompletionOptions = z.infer<typeof completionOptionsSchema>;

export const embedOptionsSchema = z.object({
  maxChunkSize: z.number().optional(),
  maxBatchSize: z.number().optional(),
});
export type EmbedOptions = z.infer<typeof embedOptionsSchema>;

export const chatOptionsSchema = z.object({
  baseSystemMessage: z.string().optional(),
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
]);

/** Prompt templates use Handlebars syntax */
const promptTemplatesSchema = z.object({
  apply: z.string().optional(),
  chatTemplate: templateSchema.optional(),
  edit: z.string().optional(),
  autocomplete: z.string().optional()
});
export type PromptTemplates = z.infer<typeof promptTemplatesSchema>;

const baseModelFields = {
  name: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  roles: modelRolesSchema.array().optional(),
  capabilities: modelCapabilitySchema.array().optional(),
  defaultCompletionOptions: completionOptionsSchema.optional(),
  requestOptions: requestOptionsSchema.optional(),
  embedOptions: embedOptionsSchema.optional(),
  chatOptions: chatOptionsSchema.optional(),
  promptTemplates: promptTemplatesSchema.optional(),
  useLegacyCompletionsEndpoint: z.boolean().optional(),
  env: z
    .record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
    .optional(),
};

export const modelSchema = z.union([
  z.object({
    ...baseModelFields,
    provider: z.literal("continue-proxy"),
    apiKeyLocation: z.string(),
    orgScopeId: z.string().nullable(),
    onPremProxyUrl: z.string().nullable(),
  }),
  z.object({
    ...baseModelFields,
    provider: z.string().refine((val) => val !== "continue-proxy"),
  }),
]);

export const partialModelSchema = z.union([
  z
    .object({
      ...baseModelFields,
      provider: z.literal("continue-proxy"),
      apiKeyLocation: z.string(),
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
