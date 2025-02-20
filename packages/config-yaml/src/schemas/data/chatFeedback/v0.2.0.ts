import { chatFeedbackEventAllSchema } from "./index.js";

export const chatFeedbackEventSchema_0_2_0 = chatFeedbackEventAllSchema.pick({
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
  feedback: true,
  sessionId: true,
});

export const chatFeedbackEventSchema_0_2_0_noCode =
  chatFeedbackEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
  });
