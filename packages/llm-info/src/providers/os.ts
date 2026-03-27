import { LlmInfo } from "../types.js";

export const OsLlms: Omit<LlmInfo, "provider">[] = [
  {
    model: "qwen3:8b",
    displayName: "Qwen 3 8B",
    contextLength: 32_768,
  },
  {
    model: "qwen3-coder:30b-a3b",
    displayName: "Qwen 3 Coder 30B",
    contextLength: 32_768,
  },
  {
    model: "deepseek-r1:14b",
    displayName: "DeepSeek R1 14B",
    contextLength: 64_000,
  },
  {
    model: "gemma3:12b",
    displayName: "Gemma 3 12B",
    contextLength: 32_768,
  },
];
