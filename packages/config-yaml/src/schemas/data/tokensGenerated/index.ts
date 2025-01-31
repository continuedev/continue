import { z } from "zod";

export const tokensGeneratedEventAllSchema = z.object({
  model: z.string(),
  provider: z.string(),
  promptTokens: z.number(),
  generatedTokens: z.number(),
});
