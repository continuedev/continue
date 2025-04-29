import { chatInteractionEventAllSchema } from "./index.js";

export const chatInteractionEventSchema_0_2_0 =
  chatInteractionEventAllSchema.pick({
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
    sessionId: true,
  });

export const chatInteractionEventSchema_0_2_0_noCode =
  chatInteractionEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
  });
