import { completionOptionsSchema } from "@continuedev/config-yaml/schemas/models";
import { z } from "zod";

export const tokensGeneratedDevDataSchema = z.object({
  model: z.string(),
  provider: z.string(),
  promptTokens: z.number(),
  generatedTokens: z.number(),
});

export const quickEditDevDataSchema = z.object({
  prompt: z.string(),
  path: z.string().optional(),
  label: z.string(),
  diffs: z
    .array(
      z.object({
        type: z.enum(["new", "old", "same"]),
        line: z.string(),
      }),
    )
    .optional(),
  model: z.string().optional(),
});

export const chatDevDataSchema = z.object({
  modelTitle: z.string(),
  completionOptions: completionOptionsSchema,
  prompt: z.string(),
  completion: z.string(),
  feedback: z.boolean().optional(),
  sessionId: z.string().uuid(),
});

export const autocompleteDevDataSchema = z.object({
  disable: z.boolean(),
  useFileSuffix: z.boolean(),
  maxPromptTokens: z.number(),
  debounceDelay: z.number(),
  maxSuffixPercentage: z.number(),
  prefixPercentage: z.number(),
  transform: z.boolean().optional(),
  template: z.string().optional(),
  multilineCompletions: z.enum(["always", "never", "auto"]),
  slidingWindowPrefixPercentage: z.number(),
  slidingWindowSize: z.number(),
  useCache: z.boolean(),
  onlyMyCode: z.boolean(),
  useRecentlyEdited: z.boolean(),
  disableInFiles: z.array(z.string()).optional(),
  useImports: z.boolean().optional(),
});

export const devDataSchemas = z.object({
  tokens_generated: tokensGeneratedDevDataSchema,
  chat: chatDevDataSchema,
  quickEdit: quickEditDevDataSchema,
  autocomplete: autocompleteDevDataSchema,
});

export type DevDataSchemas = z.infer<typeof devDataSchemas>;
export type DevDataSchemaName = keyof DevDataSchemas;
export type DevDataSchema<T extends DevDataSchemaName> = DevDataSchemas[T];

export type DevDataLogEvent = {
  [K in DevDataSchemaName]: {
    schema: K;
    data: DevDataSchemas[K];
  };
}[DevDataSchemaName];
