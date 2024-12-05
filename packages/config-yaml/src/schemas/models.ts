import { z } from "zod";

export const modelSchema = z.object({
  provider: z.string(),
  model: z.string(),
});
