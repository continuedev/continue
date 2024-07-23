import { AnthropicLlms } from "./models/anthropic.js";
import { GoogleLlms } from "./models/google.js";
import { MistralLlms } from "./models/mistral.js";
import { OpenAiLlms } from "./models/openai.js";
import { LlmInfo } from "./types.js";

export const allLlms: LlmInfo[] = [
  ...OpenAiLlms,
  ...GoogleLlms,
  ...AnthropicLlms,
  ...MistralLlms,
];

export function findLlmInfo(model: string): LlmInfo | undefined {
  return allLlms.find((llm) =>
    llm.regex ? llm.regex.test(model) : llm.model === model,
  );
}
