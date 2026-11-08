import { ModelProvider } from "../types.js";

// Context lengths and output limits are from the Bedrock model cards
// (docs.aws.amazon.com/bedrock/latest/userguide/model-card-<provider>-<model>.html,
// read 2026-11-08), which give the model ID, "Context window" and "Max output
// tokens" per model. IDs are the bedrock-runtime IDs: `deepseek.v3.2`,
// `moonshotai.kimi-k2.5`, `qwen.qwen3-coder-next`, `qwen.qwen3-next-80b-a3b`
// and `qwen.qwen3-vl-235b-a22b` carry no `-v1:0`, `openai.gpt-oss-120b-1:0`
// ends in `-1:0`, and `qwen.qwen3-32b-v1:0` and
// `qwen.qwen3-coder-30b-a3b-v1:0` in `-v1:0`.
export const Bedrock: ModelProvider = {
  models: [
    {
      model: "anthropic.claude-sonnet-4-5-20250929-v1:0",
      displayName: "Claude Sonnet 4.5",
      contextLength: 200000,
      maxCompletionTokens: 64000,
    },
    {
      model: "anthropic.claude-opus-4-6-v1",
      displayName: "Claude Opus 4.6",
      contextLength: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      model: "anthropic.claude-haiku-4-5-20251001-v1:0",
      displayName: "Claude Haiku 4.5",
      contextLength: 200000,
      maxCompletionTokens: 64000,
    },
    {
      // Only reachable through a profile (us., eu., jp., global.), so the
      // regex matches any of them. Model card: 1M context, 64K output.
      model: "amazon.nova-2-lite-v1:0",
      regex: /(^|\.)amazon\.nova-2-lite-v1:0$/,
      displayName: "Amazon Nova 2 Lite",
      contextLength: 1000000,
      maxCompletionTokens: 64000,
    },
    {
      model: "amazon.nova-pro-v1:0",
      displayName: "Amazon Nova Pro",
      contextLength: 300000,
      maxCompletionTokens: 8192,
    },
    {
      model: "amazon.nova-lite-v1:0",
      displayName: "Amazon Nova Lite",
      contextLength: 300000,
      maxCompletionTokens: 8192,
    },
    {
      model: "amazon.nova-micro-v1:0",
      displayName: "Amazon Nova Micro",
      contextLength: 128000,
      maxCompletionTokens: 8192,
    },
    {
      // Kept although Llama 4 refuses tool use in ConverseStream: the
      // Bedrock provider sends its tool requests through Converse instead
      // (bedrockToolsNeedNonStreaming in bedrockHelpers.ts).
      model: "meta.llama4-maverick-17b-instruct-v1:0",
      displayName: "Llama 4 Maverick 17B",
      contextLength: 1000000,
      maxCompletionTokens: 16384,
    },
    {
      model: "deepseek.r1-v1:0",
      displayName: "DeepSeek R1",
      contextLength: 128000,
      maxCompletionTokens: 32768,
    },
    {
      // Bedrock's ID for V3.1 (the catalog has no `deepseek.v3-v1:0`)
      model: "deepseek.v3.1",
      displayName: "DeepSeek V3.1",
      contextLength: 163840,
      maxCompletionTokens: 81920,
    },
    {
      model: "deepseek.v3.2",
      displayName: "DeepSeek V3.2",
      contextLength: 163840,
      maxCompletionTokens: 81920,
    },
    {
      // Model card: 128K context, 16K output
      model: "openai.gpt-oss-120b-1:0",
      displayName: "GPT OSS 120B",
      contextLength: 128000,
      maxCompletionTokens: 16384,
    },
    {
      // Model card: 256K context, 32K output
      model: "mistral.mistral-large-3-675b-instruct",
      displayName: "Mistral Large 3",
      contextLength: 256000,
      maxCompletionTokens: 32768,
    },
    {
      // Model card: 256K context, 16K output
      model: "moonshotai.kimi-k2.5",
      displayName: "Kimi K2.5",
      contextLength: 256000,
      maxCompletionTokens: 16384,
    },
    {
      // Model card: 256K context, 16K output
      model: "qwen.qwen3-coder-next",
      displayName: "Qwen3 Coder Next",
      contextLength: 256000,
      maxCompletionTokens: 16384,
    },
    {
      // Model card: 32K context, 8K output
      model: "qwen.qwen3-32b-v1:0",
      displayName: "Qwen3 32B",
      contextLength: 32768,
      maxCompletionTokens: 8192,
    },
    {
      // Model card: 256K context, 16K output; lifecycle Legacy, end of life
      // 2027-03-30
      model: "qwen.qwen3-coder-30b-a3b-v1:0",
      displayName: "Qwen3 Coder 30B A3B (legacy)",
      contextLength: 256000,
      maxCompletionTokens: 16384,
    },
    {
      // Model card: 256K context, 8K output
      model: "qwen.qwen3-next-80b-a3b",
      displayName: "Qwen3 Next 80B A3B",
      contextLength: 256000,
      maxCompletionTokens: 8192,
    },
    {
      // Model card: 256K context, 8K output
      model: "qwen.qwen3-vl-235b-a22b",
      displayName: "Qwen3 VL 235B A22B",
      contextLength: 256000,
      maxCompletionTokens: 8192,
    },
  ],
  id: "bedrock",
  displayName: "Bedrock",
};
