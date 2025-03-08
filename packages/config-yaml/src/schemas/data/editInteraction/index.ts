import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const editInteractionEventAllSchema = baseDevDataAllSchema.extend({
  modelProvider: z.string(),
  modelTitle: z.string(),
  prompt: z.string(),
  completion: z.string(),
});
