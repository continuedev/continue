import { toolUsageEventAllSchema } from "./index.js";

export const toolUsageEventSchema_0_2_0 = toolUsageEventAllSchema.pick({
  // base
  timestamp: true,
  userId: true,
  userAgent: true,
  selectedProfileId: true,
  eventName: true,
  schema: true,

  // tool-usage-specific
  toolCallId: true,
  functionName: true,
  functionParams: true,
  toolCallArgs: true,
  accepted: true,
  succeeded: true,
  output: true,
});

export const toolUsageEventSchema_0_2_0_noCode =
  toolUsageEventSchema_0_2_0.omit({
    functionParams: true,
    toolCallArgs: true,
    output: true,
  });
