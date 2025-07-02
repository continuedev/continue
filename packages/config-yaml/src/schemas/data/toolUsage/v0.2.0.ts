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
  functionArgs: true,
  toolCallArgs: true,
  parsedArgs: true,
  succeeded: true,
  output: true,
});

export const toolUsageEventSchema_0_2_0_noCode =
  toolUsageEventSchema_0_2_0.omit({
    functionArgs: true,
    parsedArgs: true,
    output: true,
  });
