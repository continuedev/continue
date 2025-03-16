import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const editOutcomeEventAllSchema = baseDevDataAllSchema.extend({
  modelProvider: z.string(),
  modelTitle: z.string(),
  prompt: z.string(),
  completion: z.string(),
  previousCode: z.string(),
  newCode: z.string(),
  previousCodeLines: z.number(),
  newCodeLines: z.number(),
  lineChange: z.number(),
  accepted: z.boolean(),
});
