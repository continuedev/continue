import { z } from "zod";
import { baseDevDataAllSchema } from "../base.js";

export const nextEditEventAllSchema = baseDevDataAllSchema.extend({
  fileURI: z.string(),
  workspaceDirURI: z.string(),
  beforeContent: z.string(),
  afterContent: z.string(),
  beforeCursorPos: z.object({ line: z.number(), character: z.number() }),
  afterCursorPos: z.object({ line: z.number(), character: z.number() }),
  context: z.string(),
});
