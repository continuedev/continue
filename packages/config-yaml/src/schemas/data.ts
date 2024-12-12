import { z } from "zod";

export const dataSchema = z.object({
  provider: z.string(),
});
