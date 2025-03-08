import { z } from "zod";

const modelDescriptionSchema = z.object({
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
    "nebius",
    "siliconflow",
    "scaleway",
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
  completionOptions: z
    .object({
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
    })
    .optional(),
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

const embeddingsProviderSchema = z.object({
  provider: z.enum([
    "transformers.js",
    "ollama",
    "openai",
    "cohere",
    "free-trial",
    "gemini",
    "nebius",
    "siliconflow",
    "scaleway",
  ]),
  apiBase: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  deployment: z.string().optional(),
  apiType: z.string().optional(),
  apiVersion: z.string().optional(),
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
});

const rerankerSchema = z.object({
  name: z.enum(["cohere", "voyage", "llm"]),
  params: z.record(z.any()).optional(),
});

const analyticsSchema = z.object({
  url: z.string().optional(),
  clientKey: z.string().optional(),
});

export type ControlPlaneAnalytics = z.infer<typeof analyticsSchema>;

const devDataSchema = z.object({
  url: z.string().optional(),
});

export const controlPlaneSettingsSchema = z.object({
  models: z.array(modelDescriptionSchema),
  tabAutocompleteModel: modelDescriptionSchema,
  embeddingsModel: embeddingsProviderSchema,
  reranker: rerankerSchema,
  analytics: analyticsSchema,
  devData: devDataSchema,
});

export type ControlPlaneSettings = z.infer<typeof controlPlaneSettingsSchema>;
