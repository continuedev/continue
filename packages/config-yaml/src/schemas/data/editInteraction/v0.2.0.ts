import { editInteractionEventAllSchema } from "./index.js";

export const editInteractionEventSchema_0_2_0 =
  editInteractionEventAllSchema.pick({
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
  });

export const editInteractionEventSchema_0_2_0_noCode =
  editInteractionEventSchema_0_2_0.omit({
    prompt: true,
    completion: true,
  });
