import { z } from "zod";

export const tokensGeneratedEventData = z.object({
  model: z.string(),
  provider: z.string(),
  promptTokens: z.number(),
  generatedTokens: z.number(),
});

export const tokensGeneratedEventV1Schema = tokensGeneratedEventData.pick({
  model: true,
  provider: true,
  promptTokens: true,
  generatedTokens: true,
});
