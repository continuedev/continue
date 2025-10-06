import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const nextEditOutcomeEventAllSchema = baseDevDataAllSchema.extend({
  elapsed: z.number(),
  completionOptions: z.any(),
  completionId: z.string(),
  requestId: z.string().optional(),
  gitRepo: z.string().optional(),
  uniqueId: z.string(),
  timestamp: z.number(),
  fileUri: z.string(),
  workspaceDirUri: z.string(),
  prompt: z.string(),
  userEdits: z.string(),
  userExcerpts: z.string(),
  originalEditableRange: z.string(),
  completion: z.string(),
  cursorPosition: z.object({ line: z.number(), character: z.number() }),
  accepted: z.boolean().optional(),
  aborted: z.boolean().optional(),
  modelProvider: z.string(),
  modelName: z.string(),
});
