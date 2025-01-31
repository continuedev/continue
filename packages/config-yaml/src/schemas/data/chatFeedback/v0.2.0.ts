import { chatFeedbackEventAllSchema } from "./index.js";

export const chatFeedbackEventSchema_0_2_0 = chatFeedbackEventAllSchema.pick({
  prompt: true,
  completion: true,
});

export const chatFeedbackEventSchema_0_2_0_noPII =
  chatFeedbackEventAllSchema.omit({
    prompt: true,
    completion: true,
  });
