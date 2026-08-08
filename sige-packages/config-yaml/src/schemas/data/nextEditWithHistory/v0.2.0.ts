import { nextEditEventAllSchema } from "./index.js";

export const nextEditEventSchema_0_2_0 = nextEditEventAllSchema.pick({
  // base
  timestamp: true,
  userId: true,
  userAgent: true,
  selectedProfileId: true,
  eventName: true,
  schema: true,

  // nextedit-specific
  previousEdits: true,
  fileURI: true,
  workspaceDirURI: true,
  beforeContent: true,
  afterContent: true,
  beforeCursorPos: true,
  afterCursorPos: true,
  context: true,
  modelProvider: true,
  modelName: true,
  modelTitle: true,
});

export const nextEditEventSchema_0_2_0_noCode = nextEditEventSchema_0_2_0.omit({
  previousEdits: true,
  fileURI: true,
  workspaceDirURI: true,
  beforeContent: true,
  afterContent: true,
  context: true,
});
