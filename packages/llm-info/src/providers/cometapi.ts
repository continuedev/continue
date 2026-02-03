import { ModelProvider } from "../types.js";

export const CometAPI: ModelProvider = {
  id: "cometapi",
  displayName: "CometAPI",
  models: [
    // GPT Series
    {
      model: "gpt-5-chat-latest",
      displayName: "GPT-5 Chat Latest",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Latest GPT-5 model optimized for chat conversations with enhanced reasoning capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "chatgpt-4o-latest",
      displayName: "ChatGPT-4o Latest",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Latest ChatGPT-4o model with improved performance and updated training data.",
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5-mini",
      displayName: "GPT-5 Mini",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Efficient version of GPT-5 with faster response times while maintaining high quality.",
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5-nano",
      displayName: "GPT-5 Nano",
      contextLength: 64000,
      maxCompletionTokens: 2048,
      description:
        "Ultra-fast GPT-5 variant optimized for quick responses and simple tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-5",
      displayName: "GPT-5",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Advanced GPT-5 model with state-of-the-art language understanding and generation.",
      recommendedFor: ["chat"],
    },
    {
      model: "gpt-4o-mini",
      displayName: "GPT-4o Mini",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Compact version of GPT-4o with excellent performance for most use cases.",
      recommendedFor: ["chat"],
    },
    {
      model: "o4-mini-2025-04-16",
      displayName: "o4 Mini (2025-04-16)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Optimized o4 mini model with April 2025 training improvements.",
      recommendedFor: ["chat"],
    },
    {
      model: "o3-pro-2025-06-10",
      displayName: "o3 Pro (2025-06-10)",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Professional-grade o3 model with enhanced reasoning and problem-solving capabilities.",
      recommendedFor: ["chat"],
    },

    // Claude Series
    {
      model: "claude-sonnet-4-5",
      displayName: "Claude 4.5 Sonnet",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      description:
        "Anthropic's smartest model for complex agents and coding with exceptional performance in reasoning and multilingual tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-haiku-4-5-20251001",
      displayName: "Claude 4.5 Haiku (2025-10-01)",
      contextLength: 200000,
      maxCompletionTokens: 64000,
      description:
        "Anthropic's fastest model with near-frontier intelligence, ideal for quick and accurate responses.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-opus-4-1-20250805",
      displayName: "Claude Opus 4.1 (2025-08-05)",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Most capable Claude model with exceptional reasoning, analysis, and creative capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-opus-4-1-20250805-thinking",
      displayName: "Claude Opus 4.1 Thinking (2025-08-05)",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Claude Opus with enhanced thinking process for complex problem-solving tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-sonnet-4-20250514",
      displayName: "Claude Sonnet 4 (2025-05-14)",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Balanced Claude model offering excellent performance across various tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-sonnet-4-20250514-thinking",
      displayName: "Claude Sonnet 4 Thinking (2025-05-14)",
      contextLength: 200000,
      maxCompletionTokens: 8192,
      description:
        "Claude Sonnet with enhanced reasoning capabilities for analytical tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-3-7-sonnet-latest",
      displayName: "Claude 3.7 Sonnet Latest",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Latest Claude 3.7 Sonnet with improved instruction following and safety.",
      recommendedFor: ["chat"],
    },
    {
      model: "claude-3-5-haiku-latest",
      displayName: "Claude 3.5 Haiku Latest",
      contextLength: 200000,
      maxCompletionTokens: 4096,
      description:
        "Fast and efficient Claude model optimized for quick responses.",
      recommendedFor: ["chat"],
    },

    // Gemini Series
    {
      model: "gemini-3-pro-preview",
      displayName: "Gemini 3 Pro Preview",
      contextLength: 2000000,
      maxCompletionTokens: 8192,
      description:
        "Gemini flagship model with high precision multimodal capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      contextLength: 2000000,
      maxCompletionTokens: 8192,
      description:
        "Advanced Gemini model with extensive context window and multimodal capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      contextLength: 1000000,
      maxCompletionTokens: 8192,
      description:
        "Fast Gemini model with large context window optimized for speed.",
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.5-flash-lite",
      displayName: "Gemini 2.5 Flash Lite",
      contextLength: 1000000,
      maxCompletionTokens: 4096,
      description:
        "Lightweight version of Gemini Flash for efficient processing.",
      recommendedFor: ["chat"],
    },
    {
      model: "gemini-2.0-flash",
      displayName: "Gemini 2.0 Flash",
      contextLength: 1000000,
      maxCompletionTokens: 8192,
      description:
        "High-performance Gemini model with excellent speed-quality balance.",
      recommendedFor: ["chat"],
    },

    // Grok Series
    {
      model: "grok-4-1-fast-reasoning",
      displayName: "Grok 4.1 Fast Reasoning",
      contextLength: 256000,
      maxCompletionTokens: 4096,
      description:
        "Latest Grok model with faster and improved reasoning and conversational abilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "grok-4-0709",
      displayName: "Grok 4 (07-09)",
      contextLength: 256000,
      maxCompletionTokens: 4096,
      description:
        "Latest Grok model with improved reasoning and conversational abilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "grok-3",
      displayName: "Grok 3",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Advanced Grok model with enhanced understanding and generation capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "grok-3-mini",
      displayName: "Grok 3 Mini",
      contextLength: 64000,
      maxCompletionTokens: 2048,
      description:
        "Compact Grok model optimized for efficiency and quick responses.",
      recommendedFor: ["chat"],
    },
    {
      model: "grok-2-image-1212",
      displayName: "Grok 2 Image (12-12)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Grok model with enhanced image understanding and multimodal capabilities.",
      recommendedFor: ["chat"],
    },

    // DeepSeek Series
    {
      model: "deepseek-v3.1",
      displayName: "DeepSeek V3.1",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Latest DeepSeek model with improved reasoning and coding capabilities.",
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-v3",
      displayName: "DeepSeek V3",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Advanced DeepSeek model with strong performance in technical domains.",
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-r1-0528",
      displayName: "DeepSeek R1 (05-28)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "DeepSeek reasoning model optimized for complex problem-solving tasks.",
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-chat",
      displayName: "DeepSeek Chat",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "DeepSeek model specifically optimized for conversational interactions.",
      recommendedFor: ["chat"],
    },
    {
      model: "deepseek-reasoner",
      displayName: "DeepSeek Reasoner",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "DeepSeek model with enhanced reasoning capabilities for analytical tasks.",
      recommendedFor: ["chat"],
    },

    // Qwen Series
    {
      model: "qwen3-30b-a3b",
      displayName: "Qwen3 30B A3B",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Large Qwen model with 30B parameters for high-quality text generation.",
      recommendedFor: ["chat"],
    },
    {
      model: "qwen3-coder-plus-2025-07-22",
      displayName: "Qwen3 Coder Plus (2025-07-22)",
      contextLength: 128000,
      maxCompletionTokens: 4096,
      description:
        "Qwen model specialized for coding tasks with enhanced programming capabilities.",
      recommendedFor: ["chat"],
    },
  ],
};
