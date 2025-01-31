import { z } from "zod";

export const chatDevDataSchema = z.object({
  modelTitle: z.string(),
  completionOptions: z.object({}),
  prompt: z.string(),
  completion: z.string(),
  feedback: z.boolean().optional(),
  sessionId: z.string().uuid(),
});
