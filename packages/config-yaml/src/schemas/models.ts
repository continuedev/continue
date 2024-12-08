import { z } from "zod";

export const modelRolesSchema = z.enum([
  "chat",
  "autocomplete",
  "embed",
  "rerank",
  "edit",
  "apply",
  "summarize",
]);
export type ModelRoles = z.infer<typeof modelRolesSchema>;

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

export const modelSchema = z.object({
  name: z.string(),
  provider: z.string(),
  model: z.string(),
  roles: modelRolesSchema.array().optional(),
  defaultCompletionOptions: completionOptionsSchema.optional(),
});

export type ModelConfig = z.infer<typeof modelSchema>;
