import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const chatInteractionEventAllSchema = baseDevDataAllSchema.extend({
  modelProvider: z.string(),
  modelName: z.string(),
  modelTitle: z.string(),
  prompt: z.string(),
  completion: z.string(),
  sessionId: z.string(),
  tools: z.array(z.string()).optional(),
  rules: z
    .array(
      z.object({
        id: z.string(),
        slug: z.string().optional(),
      }),
    )
    .optional(),
});
