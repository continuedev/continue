import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const tokensGeneratedEventAllSchema = baseDevDataAllSchema.extend({
  model: z.string(),
  provider: z.string(),
  promptTokens: z.number(),
  generatedTokens: z.number(),
});
