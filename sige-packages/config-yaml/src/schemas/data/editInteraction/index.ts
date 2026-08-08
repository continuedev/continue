import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

/**
 * The "editInteraction" event is sent whenever the user submits an input in edit mode and the model's response is completed
 */
export const editInteractionEventAllSchema = baseDevDataAllSchema.extend({
  modelProvider: z.string(),
  modelName: z.string(),
  modelTitle: z.string(),
  prompt: z.string(),
  completion: z.string(),
  filepath: z.string(),
});
