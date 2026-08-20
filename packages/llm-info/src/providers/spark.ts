import { ModelProvider } from "../types.js";

export const Spark: ModelProvider = {
  models: [
    {
      model: "4.0Ultra",
      displayName: "Spark 4.0 Ultra",
      contextLength: 32768,
      maxCompletionTokens: 8192,
      description:
        "iFLYTEK's flagship Spark model with the strongest general capabilities.",
      regex: /4\.0Ultra/i,
      recommendedFor: ["chat"],
    },
    {
      model: "generalv3.5",
      displayName: "Spark Max",
      contextLength: 8192,
      maxCompletionTokens: 8192,
      description: "High-capability Spark model with function calling support.",
      regex: /generalv3\.5/i,
      recommendedFor: ["chat"],
    },
    {
      model: "max-32k",
      displayName: "Spark Max-32K",
      contextLength: 32768,
      maxCompletionTokens: 8192,
      description: "Spark Max with an extended 32K context window.",
      regex: /max-32k/i,
    },
    {
      model: "generalv3",
      displayName: "Spark Pro",
      contextLength: 8192,
      maxCompletionTokens: 8192,
      description: "Cost-effective Spark model for everyday tasks.",
      regex: /^generalv3$/i,
    },
    {
      model: "pro-128k",
      displayName: "Spark Pro-128K",
      contextLength: 131072,
      maxCompletionTokens: 8192,
      description: "Spark Pro with a long 128K context window.",
      regex: /pro-128k/i,
    },
    {
      model: "lite",
      displayName: "Spark Lite",
      contextLength: 8192,
      maxCompletionTokens: 4096,
      description: "Lightweight, low-latency Spark model.",
      regex: /^lite$/i,
    },
  ],
  id: "spark",
  displayName: "iFLYTEK Spark",
};
