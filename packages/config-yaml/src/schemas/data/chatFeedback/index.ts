import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const chatFeedbackEventAllSchema = baseDevDataAllSchema.extend({
  modelTitle: z.string(),
  completionOptions: z.object({}),
  prompt: z.string(),
  completion: z.string(),
  feedback: z.boolean().optional(),
  sessionId: z.string().uuid(),
});
