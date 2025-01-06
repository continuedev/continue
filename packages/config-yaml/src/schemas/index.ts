import * as z from "zod";
import { contextSchema } from "./context.js";
import { dataSchema } from "./data.js";
import { modelSchema } from "./models.js";

const packageSchema = z.object({
  uses: z.string(),
  with: z.any().optional(),
  secrets: z.array(z.string()).optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  policy: z.enum(["automatic", "allowed", "disabled"]).optional(),
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
  type: z.enum(["slash-command", "context-provider"]).optional(),
  prompt: z.string(),
});

export const configYamlSchema = z.object({
  name: z.string(),
  version: z.string(),
  packages: z.array(packageSchema).optional(),
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataSchema).optional(),
  tools: z.array(toolSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
  rules: z.string().optional(),
  prompts: z.array(promptSchema).optional(),
});

export type ConfigYaml = z.infer<typeof configYamlSchema>;
