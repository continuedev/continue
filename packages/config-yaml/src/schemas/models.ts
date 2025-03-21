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

export const embeddingTasksSchema = z.union([
  z.literal("chunk"),
  z.literal("query")
]);
export type EmbeddingTasks = z.infer<typeof embeddingTasksSchema>;

export const embeddingPrefixesSchema = z.record(embeddingTasksSchema, z.string());
export type EmbeddingPrefixes = z.infer<typeof embeddingPrefixesSchema>;

export const embedOptionsSchema = z.object({
  maxChunkSize: z.number().optional(),
  maxBatchSize: z.number().optional(),
  embeddingPrefixes: embeddingPrefixesSchema.optional(),
});
export type EmbedOptions = z.infer<typeof embedOptionsSchema>;

/** Prompt templates use Handlebars syntax */
const promptTemplatesSchema = z.object({
  apply: z.string().optional(),
  edit: z.string().optional(),
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
  promptTemplates: promptTemplatesSchema.optional(),
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
