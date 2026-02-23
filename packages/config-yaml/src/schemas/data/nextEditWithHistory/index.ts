import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const nextEditEventAllSchema = baseDevDataAllSchema.extend({
  previousEdits: z.array(
    z.object({
      filename: z.string(),
      diff: z.string(),
    }),
  ),
  fileURI: z.string(),
  workspaceDirURI: z.string(),
  beforeContent: z.string(),
  afterContent: z.string(),
  beforeCursorPos: z.object({ line: z.number(), character: z.number() }),
  afterCursorPos: z.object({ line: z.number(), character: z.number() }),
  context: z.string(),
  modelProvider: z.string(),
  modelName: z.string(),
  modelTitle: z.string(),
});
