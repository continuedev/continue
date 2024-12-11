import { z } from "zod";

export const contextSchema = z.object({
  uses: z.string(),
  with: z.any().optional(),
});
