import { z } from "zod";

export const quickEditEventAllSchema = z.object({
  prompt: z.string(),
  path: z.string().optional(),
  label: z.string(),
  diffs: z
    .array(
      z.object({
        type: z.enum(["new", "old", "same"]),
        line: z.string(),
      }),
    )
    .optional(),
  model: z.string().optional(),
});
