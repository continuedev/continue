import { editOutcomeEventAllSchema } from "./index.js";

export const editOutcomeEventSchema_0_2_0 = editOutcomeEventAllSchema.pick({
  // base
  timestamp: true,
  userId: true,
  userAgent: true,
  selectedProfileId: true,
  eventName: true,
  schema: true,

  // other
  prompt: true,
  completion: true,
  modelTitle: true,
  modelProvider: true,
  accepted: true,
  previousCode: true,
  newCode: true,
  previousCodeLines: true,
  newCodeLines: true,
  lineChange: true,
});

export const editOutcomeEventSchema_0_2_0_noCode =
  editOutcomeEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
    previousCode: true,
    newCode: true,
  });
