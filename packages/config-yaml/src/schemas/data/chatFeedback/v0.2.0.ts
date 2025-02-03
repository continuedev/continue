import { chatFeedbackEventAllSchema } from "./index.js";

export const chatFeedbackEventSchema_0_2_0 = chatFeedbackEventAllSchema.pick({
  // base
  createdAt: true,
  userId: true,
  userAgent: true,
  platform: true,
  selectedProfileId: true,
  eventName: true,
  schemaVersion: true,
  sessionId: true,

  // other
  prompt: true,
  completion: true,
  modelTitle: true,
  feedback: true,
});

export const chatFeedbackEventSchema_0_2_0_noPII =
  chatFeedbackEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
  });
