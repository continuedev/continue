import { baseDevDataSchema_0_2_0 } from "../base/0.2.0.js";
import { chatFeedbackEventAllSchema } from "./index.js";

export const chatFeedbackEventSchema_0_2_0 = baseDevDataSchema_0_2_0.merge(
  chatFeedbackEventAllSchema.pick({
    prompt: true,
    completion: true,
    modelTitle: true,
    feedback: true,
    sessionId: true,
  }),
);

export const chatFeedbackEventSchema_0_2_0_noPII =
  chatFeedbackEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
  });
