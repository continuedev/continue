import * as z from "zod";
export * from "./models.js";
import { modelSchema, requestOptionsSchema } from "./models.js";

const packageSchema = z.object({
  uses: z.string(),
  with: z.any().optional(),
});

export const contextSchema = z.object({
  uses: z.string(),
  with: z.any().optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  apiKey: z.string().optional(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

const promptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
});

const docSchema = z.object({
  name: z.string(),
  startUrl: z.string(),
  rootUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
});

const dataDestinationSchema = z.object({
  name: z.string(),
  destination: z.string().url(),
  version: z.union([z.literal(1), z.literal(2)]),
  events: z.array(z.string()).optional(), // Could do literals e.g. "autocomplete", "chat" but want to allow some flexibility later
  requestOptions: requestOptionsSchema.optional(),
  apiKey: z.string().optional(),
});

export const configYamlSchema = z.object({
  name: z.string(),
  version: z.string(),
  packages: z.array(packageSchema).optional(),
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataDestinationSchema).optional(),
  tools: z.array(toolSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
  rules: z.array(z.string()).optional(),
  prompts: z.array(promptSchema).optional(),
  docs: z.array(docSchema).optional(),
});

export type ConfigYaml = z.infer<typeof configYamlSchema>;

export const unrolledConfigYamlSchema = configYamlSchema.omit({
  packages: true,
});

export type UnrolledConfigYaml = z.infer<typeof unrolledConfigYamlSchema>;
