import * as z from "zod";
import { modelSchema, partialModelSchema } from "./models.js";
import { dataSchema } from "./data/index.js";

export const contextSchema = z.object({
  provider: z.string(),
  params: z.any().optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  run: z.string(),
  params: z.any().optional(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  faviconUrl: z.string().optional(),
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

export const blockItemWrapperSchema = <T extends z.AnyZodObject>(schema: T) =>
  z.object({
    uses: z.string(),
    with: z.record(z.string()).optional(),
    override: schema.partial().optional(),
  });

export const blockOrSchema = <T extends z.AnyZodObject>(schema: T) =>
  z.union([schema, blockItemWrapperSchema(schema)]);

export const configYamlSchema = z.object({
  name: z.string(),
  version: z.string(),
  models: z
    .array(
      z.union([
        modelSchema,
        z.object({
          uses: z.string(),
          with: z.record(z.string()).optional(),
          override: partialModelSchema.optional(),
        }),
      ]),
    )
    .optional(),
  context: z.array(blockOrSchema(contextSchema)).optional(),
  data: z.array(blockOrSchema(dataSchema)).optional(),
  tools: z.array(blockOrSchema(toolSchema)).optional(),
  mcpServers: z.array(blockOrSchema(mcpServerSchema)).optional(),
  rules: z
    .array(
      z.union([
        z.string(),
        z.object({
          uses: z.string(),
          with: z.record(z.string()).optional(),
        }),
      ]),
    )
    .optional(),
  prompts: z.array(blockOrSchema(promptSchema)).optional(),
  docs: z.array(blockOrSchema(docSchema)).optional(),
});

export type ConfigYaml = z.infer<typeof configYamlSchema>;

export const assistantUnrolledSchema = z.object({
  name: z.string(),
  version: z.string(),
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataSchema).optional(),
  tools: z.array(toolSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
  rules: z.array(z.string()).optional(),
  prompts: z.array(promptSchema).optional(),
  docs: z.array(docSchema).optional(),
});

export type AssistantUnrolled = z.infer<typeof assistantUnrolledSchema>;

export const blockSchema = z
  .object({
    name: z.string(),
    version: z.string(),
  })
  .and(
    z.union([
      z.object({ models: z.array(modelSchema).length(1) }),
      z.object({ context: z.array(contextSchema).length(1) }),
      z.object({ data: z.array(dataSchema).length(1) }),
      z.object({ tools: z.array(toolSchema).length(1) }),
      z.object({ mcpServers: z.array(mcpServerSchema).length(1) }),
      z.object({ rules: z.array(z.string()).length(1) }),
      z.object({ prompts: z.array(promptSchema).length(1) }),
      z.object({ docs: z.array(docSchema).length(1) }),
    ]),
  );

export type Block = z.infer<typeof blockSchema>;
