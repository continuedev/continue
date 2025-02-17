import { chatFeedbackEventAllSchema } from "./index.js";

export const chatFeedbackEventSchema_0_1_0 = chatFeedbackEventAllSchema.pick({
  modelTitle: true,
  completionOptions: true,
  prompt: true,
  completion: true,
  feedback: true,
  sessionId: true,
});

export const chatFeedbackEventSchema_0_1_0_noCode =
  chatFeedbackEventSchema_0_1_0.omit({
    prompt: true,
    completion: true,
  });
