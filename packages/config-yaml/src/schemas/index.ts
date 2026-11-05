import * as z from "zod";
import { commonModelSlugs } from "./commonSlugs.js";
import { dataSchema } from "./data/index.js";
import { mcpServerSchema, partialMcpServerSchema } from "./mcp/index.js";
import {
  connectedModelSchema,
  modelSchema,
  partialModelSchema,
  requestOptionsSchema,
} from "./models.js";

export const contextSchema = z.object({
  name: z.string().optional(),
  provider: z.string(),
  params: z.any().optional(),
});

export { MCPServer } from "./mcp/index.js";

const promptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  sourceFile: z.string().optional(),
});

export type Prompt = z.infer<typeof promptSchema>;

const docSchema = z.object({
  name: z.string(),
  startUrl: z.string(),
  rootUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  useLocalCrawling: z.boolean().optional(),
  sourceFile: z.string().optional(),
});

export type DocsConfig = z.infer<typeof docSchema>;

const ruleObjectSchema = z.object({
  name: z.string(),
  rule: z.string(),
  description: z.string().optional(),
  globs: z.union([z.string(), z.array(z.string())]).optional(),
  regex: z.union([z.string(), z.array(z.string())]).optional(),
  alwaysApply: z.boolean().optional(),
  invokable: z.boolean().optional(),
  sourceFile: z.string().optional(),
});
const ruleSchema = z.union([z.string(), ruleObjectSchema]);

/**
 * A schema for rules.json files
 */
export const rulesJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  author: z.string().optional(),
  license: z.string().optional(),
  rules: z.record(z.string(), z.string()).optional(),
});

export type Rule = z.infer<typeof ruleSchema>;
export type RuleObject = z.infer<typeof ruleObjectSchema>;
/**
 * A schema for rules.json files
 */
export type RulesJson = z.infer<typeof rulesJsonSchema>;

const defaultUsesSchema = z.string();

export const blockItemWrapperSchema = <T extends z.ZodObject>(
  schema: T,
  usesSchema: z.ZodType<any> = defaultUsesSchema,
) =>
  z.object({
    uses: usesSchema,
    with: z.record(z.string(), z.string()).optional(),
    override: schema.partial().optional(),
  });

export const blockOrSchema = <T extends z.ZodObject>(
  schema: T,
  usesSchema: z.ZodType<any> = defaultUsesSchema,
) => z.union([schema, blockItemWrapperSchema(schema, usesSchema)]);

export const commonMetadataSchema = z.object({
  tags: z.string().optional(),
  sourceCodeUrl: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  iconUrl: z.string().optional(),
});

const envRecord = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

/** Reasoning effort a mode asks for; mapped to a thinking budget by the client. */
export const reasoningEffortSchema = z.enum(["off", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

/**
 * Model (by its `name` in `models:`) to use in a chat mode, plus an optional
 * reasoning effort for that mode.
 */
export const modeModelSchema = z
  .object({
    /** Default model when switching into the mode (by `name`). */
    model: z.string().optional(),
    /**
     * Models offered while in the mode (by `name`). When `model` is not set the
     * default is the first entry that exists. The default is always offered.
     */
    models: z.array(z.string()).optional(),
    reasoningEffort: reasoningEffortSchema.optional(),
  })
  .refine((m) => m.model !== undefined || (m.models?.length ?? 0) > 0, {
    message: "Set `model`, or a non-empty `models` list",
  });
export type ModeModel = z.infer<typeof modeModelSchema>;

/** Per-mode model selection. Modes without an entry keep the current model. */
export const modeModelsSchema = z.object({
  chat: modeModelSchema.optional(),
  agent: modeModelSchema.optional(),
  plan: modeModelSchema.optional(),
});
export type ModeModels = z.infer<typeof modeModelsSchema>;

/**
 * Whether rules are sent in each chat mode. A mode left out is enabled, so
 * `rulesByMode: { chat: false }` turns rules off in Chat only.
 */
export const rulesByModeSchema = z.object({
  chat: z.boolean().optional(),
  agent: z.boolean().optional(),
  plan: z.boolean().optional(),
});
export type RulesByMode = z.infer<typeof rulesByModeSchema>;

/**
 * Rules for tool calls, written `toolName(pattern)` or a bare `toolName`.
 * Deny always wins over ask, and ask over allow. `auto` only configures the
 * experimental reviewer (Auto mode) and never loosens a rule. See plans/tool-auto-approval.md.
 */
export const toolPermissionsSchema = z.object({
  allow: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  auto: z
    .object({
      /** Facts the reviewer model is told about, to judge "unknown destination" and "production". */
      environment: z
        .object({
          trustedDomains: z.array(z.string()).optional(),
          productionMarkers: z.array(z.string()).optional(),
        })
        .optional(),
      /** Plain-language guidance added to the reviewer's prompt. */
      guidance: z
        .object({
          block: z.array(z.string()).optional(),
          allow: z.array(z.string()).optional(),
        })
        .optional(),
      /** Stop the agent and ask after this many refusals in a row, or in total. */
      limits: z
        .object({
          consecutiveDenials: z.number().int().min(1).optional(),
          totalDenials: z.number().int().min(1).optional(),
        })
        .optional(),
    })
    .optional(),
});
export type ToolPermissions = z.infer<typeof toolPermissionsSchema>;

export const baseConfigYamlSchema = z.object({
  name: z.string(),
  version: z.string(),
  schema: z.string().optional(),
  metadata: z
    .record(z.string(), z.string())
    .and(commonMetadataSchema.partial())
    .optional(),
  modeModels: modeModelsSchema.optional(),
  rulesByMode: rulesByModeSchema.optional(),
  toolPermissions: toolPermissionsSchema.optional(),
  env: envRecord.optional(),
  requestOptions: requestOptionsSchema.optional(),
});

const modelsUsesSchema = z
  .string()
  .or(z.enum(commonModelSlugs as [string, ...string[]]));

export const configYamlSchema = baseConfigYamlSchema.extend({
  models: z
    .array(
      z.union([
        modelSchema,
        connectedModelSchema,
        z.object({
          uses: modelsUsesSchema,
          with: z.record(z.string(), z.string()).optional(),
          override: partialModelSchema.optional(),
        }),
      ]),
    )
    .optional(),
  context: z.array(blockOrSchema(contextSchema)).optional(),
  data: z.array(blockOrSchema(dataSchema)).optional(),
  mcpServers: z
    .array(
      z.union([
        mcpServerSchema,
        z.object({
          uses: defaultUsesSchema,
          with: z.record(z.string(), z.string()).optional(),
          override: partialMcpServerSchema.optional(),
        }),
      ]),
    )
    .optional(),
  rules: z
    .array(
      z.union([
        ruleSchema,
        z.object({
          uses: defaultUsesSchema,
          with: z.record(z.string(), z.string()).optional(),
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
    z.object({
      models: z.array(z.union([modelSchema, connectedModelSchema])).length(1),
    }),
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
  env: envRecord.optional(),
  requestOptions: requestOptionsSchema.optional(),
});

export type Config = z.infer<typeof configSchema>;
