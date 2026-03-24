import { ModelProvider } from "../types.js";

export const MiniMax: ModelProvider = {
  models: [
    {
      model: "MiniMax-M2.7",
      displayName: "MiniMax M2.7",
      contextLength: 204800,
      maxCompletionTokens: 192000,
      description:
        "Latest flagship model with enhanced reasoning and coding capabilities.",
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
    {
      model: "MiniMax-M2.5",
      displayName: "MiniMax M2.5",
      contextLength: 204800,
      maxCompletionTokens: 192000,
      description:
        "Peak performance with ultimate value. Excels at complex reasoning, code generation, and multi-step tasks.",
      regex: /MiniMax-M2\.5$/i,
      recommendedFor: ["chat"],
    },
    {
      model: "MiniMax-M2.5-highspeed",
      displayName: "MiniMax M2.5 Highspeed",
      contextLength: 204800,
      maxCompletionTokens: 192000,
      description:
        "Same performance as M2.5, faster and more agile for latency-sensitive tasks.",
      regex: /MiniMax-M2\.5-highspeed/i,
      recommendedFor: ["chat"],
    },
  ],
  id: "minimax",
  displayName: "MiniMax",
};
