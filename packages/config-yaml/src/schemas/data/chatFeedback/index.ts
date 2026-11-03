import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const chatFeedbackEventAllSchema = baseDevDataAllSchema.extend({
  modelProvider: z.string(),
  modelName: z.string(),
  modelTitle: z.string(),
  completionOptions: z.object({}),
  prompt: z.string(),
  completion: z.string(),
  feedback: z.boolean().optional(),
  // guid() matches zod 3 uuid(): any 8-4-4-4-12 hex string, no version check
  sessionId: z.string().guid(),
});
