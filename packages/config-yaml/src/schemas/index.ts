import * as z from "zod";
import { contextSchema } from "./context.js";
import { dataSchema } from "./data.js";
import { modelSchema } from "./models.js";

const packageSchema = z.object({
  uses: z.string(),
  with: z.any().optional(),
});

const toolSchema = z.object({
  url: z.string(),
  apiKey: z.string().optional(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),

  env: z.record(z.string()).optional(),
});

export const configYamlSchema = z.object({
  name: z.string(),
  packages: z.array(packageSchema).optional(),
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataSchema).optional(),
  tools: z.array(toolSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
});

export type ConfigYaml = z.infer<typeof configYamlSchema>;
