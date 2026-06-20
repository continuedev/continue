import { ModelProvider } from "../types.js";

export const MiniMax: ModelProvider = {
  models: [
    {
      model: "MiniMax-M3",
      displayName: "MiniMax M3",
      contextLength: 524288,
      maxCompletionTokens: 131072,
      description:
        "Latest flagship model with a 512K context window, 128K max output, and image input support.",
      regex: /MiniMax-M3$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "MiniMax-M2.7",
      displayName: "MiniMax M2.7",
      contextLength: 204800,
      maxCompletionTokens: 192000,
      description:
        "Previous flagship model with enhanced reasoning and coding capabilities.",
      regex: /MiniMax-M2\.7$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "MiniMax-M2.7-highspeed",
      displayName: "MiniMax M2.7 Highspeed",
      contextLength: 204800,
      maxCompletionTokens: 192000,
      description: "High-speed version of M2.7 for low-latency scenarios.",
      regex: /MiniMax-M2\.7-highspeed/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "minimax",
  displayName: "MiniMax",
};
