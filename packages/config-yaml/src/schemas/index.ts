import * as z from "zod";
import { commonModelSlugs } from "./commonSlugs.js";
import { dataSchema } from "./data/index.js";
import { modelSchema, partialModelSchema } from "./models.js";

export const contextSchema = z.object({
  name: z.string().optional(),
  provider: z.string(),
  params: z.any().optional(),
});

const mcpServerSchema = z.object({
  name: z.string(),
  command: z.string(),
  faviconUrl: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export type MCPServer = z.infer<typeof mcpServerSchema>;

const promptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
});

export type Prompt = z.infer<typeof promptSchema>;

const docSchema = z.object({
  name: z.string(),
  startUrl: z.string(),
  rootUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
});

export type DocsConfig = z.infer<typeof docSchema>;
const ruleObjectSchema = z.object({
  name: z.string(),
  rule: z.string(),
  globs: z.union([z.string(), z.array(z.string())]).optional(),
});
const ruleSchema = z.union([z.string(), ruleObjectSchema]);

export type Rule = z.infer<typeof ruleSchema>;
export type RuleObject = z.infer<typeof ruleObjectSchema>;

const defaultUsesSchema = z.string();

export const blockItemWrapperSchema = <T extends z.AnyZodObject>(
  schema: T,
  usesSchema: z.ZodTypeAny = defaultUsesSchema,
) =>
  z.object({
    uses: usesSchema,
    with: z.record(z.string()).optional(),
    override: schema.partial().optional(),
  });

export const blockOrSchema = <T extends z.AnyZodObject>(
  schema: T,
  usesSchema: z.ZodTypeAny = defaultUsesSchema,
) => z.union([schema, blockItemWrapperSchema(schema, usesSchema)]);

export const commonMetadataSchema = z.object({
  tags: z.string().optional(),
  sourceCodeUrl: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  iconUrl: z.string().optional(),
});

export const baseConfigYamlSchema = z.object({
  name: z.string(),
  version: z.string(),
  schema: z.string().optional(),
  metadata: z.record(z.string()).and(commonMetadataSchema.partial()).optional(),
});

const modelsUsesSchema = z
  .string()
  .or(z.enum(commonModelSlugs as [string, ...string[]]));

export const configYamlSchema = baseConfigYamlSchema.extend({
  models: z
    .array(
      z.union([
        modelSchema,
        z.object({
          uses: modelsUsesSchema,
          with: z.record(z.string()).optional(),
          override: partialModelSchema.optional(),
        }),
      ]),
    )
    .optional(),
  context: z.array(blockOrSchema(contextSchema)).optional(),
  data: z.array(blockOrSchema(dataSchema)).optional(),
  mcpServers: z.array(blockOrSchema(mcpServerSchema)).optional(),
  rules: z
    .array(
      z.union([
        ruleSchema,
        z.object({
          uses: defaultUsesSchema,
          with: z.record(z.string()).optional(),
        }),
      ]),
    )
    .optional(),
  prompts: z.array(blockOrSchema(promptSchema)).optional(),
  docs: z.array(blockOrSchema(docSchema)).optional(),
});

export type ConfigYaml = z.infer<typeof configYamlSchema>;

export const assistantUnrolledSchema = baseConfigYamlSchema.extend({
  models: z.array(modelSchema.nullable()).optional(),
  context: z.array(contextSchema.nullable()).optional(),
  data: z.array(dataSchema.nullable()).optional(),
  mcpServers: z.array(mcpServerSchema.nullable()).optional(),
  rules: z.array(ruleSchema.nullable()).optional(),
  prompts: z.array(promptSchema.nullable()).optional(),
  docs: z.array(docSchema.nullable()).optional(),
});

export type AssistantUnrolled = z.infer<typeof assistantUnrolledSchema>;

export const assistantUnrolledSchemaNonNullable = baseConfigYamlSchema.extend({
  models: z.array(modelSchema).optional(),
  context: z.array(contextSchema).optional(),
  data: z.array(dataSchema).optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
  rules: z.array(ruleSchema).optional(),
  prompts: z.array(promptSchema).optional(),
  docs: z.array(docSchema).optional(),
});

export type AssistantUnrolledNonNullable = z.infer<
  typeof assistantUnrolledSchemaNonNullable
>;

export const isAssistantUnrolledNonNullable = (
  a: AssistantUnrolled,
): a is AssistantUnrolledNonNullable =>
  (!a.models || a.models.every((m) => m !== null)) &&
  (!a.context || a.context.every((c) => c !== null)) &&
  (!a.data || a.data.every((d) => d !== null)) &&
  (!a.mcpServers || a.mcpServers.every((s) => s !== null)) &&
  (!a.rules || a.rules.every((r) => r !== null)) &&
  (!a.prompts || a.prompts.every((p) => p !== null)) &&
  (!a.docs || a.docs.every((d) => d !== null));

export const blockSchema = baseConfigYamlSchema.and(
  z.union([
    z.object({ models: z.array(modelSchema).length(1) }),
    z.object({ context: z.array(contextSchema).length(1) }),
    z.object({ data: z.array(dataSchema).length(1) }),
    z.object({ mcpServers: z.array(mcpServerSchema).length(1) }),
    z.object({
      rules: z.array(ruleSchema).length(1),
    }),
    z.object({ prompts: z.array(promptSchema).length(1) }),
    z.object({ docs: z.array(docSchema).length(1) }),
  ]),
);

export type Block = z.infer<typeof blockSchema>;

export const continueCommandSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  placeholders: z.array(z.string()).optional(),
  context: z.string().optional(),
  contextWindowSize: z.number().optional(),
  model: z.string().optional(),
  systemMessage: z.string().optional(),
  slashCommand: z.string().optional(),
  hideFromCommandPalette: z.boolean().optional(),
  hideFromSlashCommands: z.boolean().optional(),
  mode: z.enum(["insert", "replace", "diff"]).optional(),
  addEnhancedContext: z.boolean().optional(),
});

export const languageMarkerSchema = z.object({
  language: z.string(),
  markers: z.array(z.string()),
});

export const sidebarSchema = z.object({
  enabled: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  defaultWidth: z.number().optional(),
  showButtonsThreshold: z.number().optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  defaultIcon: z.string().optional(),
});

export const autoindentExtensionsSchema = z.array(z.string());

export const configSchema = z.object({
  models: z.array(modelSchema).optional(),
  defaultModel: z.string().optional(),
  defaultRecentMessages: z.number().optional(),
  commands: z.array(continueCommandSchema).optional(),
  tools: z.array(toolSchema).optional(),
  contextProviders: z.array(z.any()).optional(),
  langMarkers: z.array(languageMarkerSchema).optional(),
  sidebar: sidebarSchema.optional(),
  tabAutocompleteModel: z.string().optional(),
  rules: z.array(ruleObjectSchema).optional(),
  doneWithBannerForever: z.boolean().optional(),
  autoindentExtensions: autoindentExtensionsSchema.optional(),
  proxy: z.string().optional(),
  api_base: z.string().optional(),
  api_key: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;
