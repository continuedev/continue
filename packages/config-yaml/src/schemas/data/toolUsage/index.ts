import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const toolUsageEventAllSchema = baseDevDataAllSchema.extend({
  toolCallId: z.string(),
  functionName: z.string(),
  functionParams: z.record(z.string(), z.any()).optional(),
  toolCallArgs: z.string(),
  accepted: z.boolean(),
  succeeded: z.boolean(),
  output: z.array(z.any()).optional(),
});
