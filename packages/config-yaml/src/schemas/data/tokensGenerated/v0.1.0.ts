import { tokensGeneratedEventAllSchema } from "./index.js";

export const tokensGeneratedEventSchema_0_1_0 =
  tokensGeneratedEventAllSchema.pick({
    model: true,
    provider: true,
    promptTokens: true,
    generatedTokens: true,
  });

export const tokensGeneratedEventSchema_0_1_0_noCode =
  tokensGeneratedEventSchema_0_1_0;
