import { ModelProvider } from "../types.js";

export const Anthropic: ModelProvider = {
    id: "aiCore",
    displayName: "SAP AI Core",
    models: [
        {
            model: "anthropic--claude-4-sonnet",
            displayName: "Claude 4 Sonnet",
            contextLength: 200000,
            maxCompletionTokens: 8192,
            recommendedFor: ["chat"],
        },
        {
            model: "anthropic--claude-3.7-sonnet",
            displayName: "Claude 3.7 Sonnet",
            contextLength: 200000,
            maxCompletionTokens: 8192,
            recommendedFor: ["chat"],
        },
        {
            model: "gpt-4o",
            displayName: "GPT-4o",
            contextLength: 128000,
            maxCompletionTokens: 8192,
            recommendedFor: ["chat"],
        },
        {
            model: "gpt-4.1",
            displayName: "GPT-4.1",
            contextLength: 200000,
            maxCompletionTokens: 8192,
            recommendedFor: ["chat"],
        },

    ],
};
