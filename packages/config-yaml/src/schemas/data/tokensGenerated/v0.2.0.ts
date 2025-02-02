import { baseDevDataSchema_0_2_0 } from "../base/0.2.0.js";
import { tokensGeneratedEventAllSchema } from "./index.js";

export const tokensGeneratedEventSchema_0_2_0 = baseDevDataSchema_0_2_0.merge(
  tokensGeneratedEventAllSchema.pick({
    model: true,
    provider: true,
    promptTokens: true,
    generatedTokens: true,
  }),
);

export const tokensGeneratedEventSchema_0_2_0_noPII =
  tokensGeneratedEventSchema_0_2_0;
