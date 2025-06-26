import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const toolUsageEventAllSchema = baseDevDataAllSchema.extend({
  toolCallId: z.string(),
  functionName: z.string(),
  functionArgs: z.string(),
  parsedArgs: z.any(),
  succeeded: z.boolean(),
  output: z.array(z.any()).optional(),
});
