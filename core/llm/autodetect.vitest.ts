import { expect, test } from "vitest";
import { autodetectTemplateType } from "./autodetect";

test("autodetectTemplateType returns 'codellama-70b' for CodeLlama 70B models", () => {
  expect(autodetectTemplateType("codellama-70b")).toBe("codellama-70b");
  expect(autodetectTemplateType("CodeLlama-70B")).toBe("codellama-70b");
  expect(autodetectTemplateType("codellama-70b-instruct")).toBe(
    "codellama-70b",
  );
  expect(autodetectTemplateType("CodeLlama-70B-Python")).toBe("codellama-70b");
});

test("autodetectTemplateType returns undefined for models that don't need templates", () => {
  expect(autodetectTemplateType("gpt-4")).toBe(undefined);
  expect(autodetectTemplateType("gpt-3.5-turbo")).toBe(undefined);
  expect(autodetectTemplateType("GPT-4")).toBe(undefined);
  expect(autodetectTemplateType("command-r")).toBe(undefined);
  expect(autodetectTemplateType("aya-23")).toBe(undefined);
  expect(autodetectTemplateType("chat-bison")).toBe(undefined);
  expect(autodetectTemplateType("pplx-70b")).toBe(undefined);
  expect(autodetectTemplateType("gemini-pro")).toBe(undefined);
  expect(autodetectTemplateType("grok-beta")).toBe(undefined);
  expect(autodetectTemplateType("moonshot-v1")).toBe(undefined);
  expect(autodetectTemplateType("mercury-chat")).toBe(undefined);
  expect(autodetectTemplateType("mercury-chat")).toBe(undefined);
  expect(autodetectTemplateType("o3-mini")).toBe(undefined);
  expect(autodetectTemplateType("o4")).toBe(undefined);
  expect(autodetectTemplateType("claude-sonnet-4-20250514")).toBe("none");
  expect(autodetectTemplateType("claude-3-7-sonnet-latest")).toBe("none");
});

test("autodetectTemplateType returns 'llama3' for Llama 3 models", () => {
  expect(autodetectTemplateType("llama3")).toBe("llama3");
  expect(autodetectTemplateType("llama-3")).toBe("llama3");
  expect(autodetectTemplateType("Llama3-8B")).toBe("llama3");
  expect(autodetectTemplateType("llama-3:70b")).toBe("llama3");
});

test("autodetectTemplateType returns 'llava' for LLaVA models", () => {
  expect(autodetectTemplateType("llava")).toBe("llava");
  expect(autodetectTemplateType("LLaVA")).toBe("llava");
  expect(autodetectTemplateType("llava-1.5")).toBe("llava");
  expect(autodetectTemplateType("llava-v1.6")).toBe("llava");
});

test("autodetectTemplateType returns 'zephyr' for TinyLlama models", () => {
  expect(autodetectTemplateType("tinyllama")).toBe("zephyr");
  expect(autodetectTemplateType("TinyLlama")).toBe("zephyr");
  expect(autodetectTemplateType("tinyllama-1.1b")).toBe("zephyr");
});

test("autodetectTemplateType returns 'xwin-coder' for XWin models", () => {
  expect(autodetectTemplateType("xwin")).toBe("xwin-coder");
  expect(autodetectTemplateType("XWin")).toBe("xwin-coder");
  expect(autodetectTemplateType("xwin-coder")).toBe("xwin-coder");
});

test("autodetectTemplateType returns 'chatml' for Dolphin models", () => {
  expect(autodetectTemplateType("dolphin")).toBe("chatml");
  expect(autodetectTemplateType("Dolphin")).toBe("chatml");
  expect(autodetectTemplateType("dolphin-2.1")).toBe("chatml");
});

test("autodetectTemplateType returns 'gemma' for Gemma models", () => {
  expect(autodetectTemplateType("gemma")).toBe("gemma");
  expect(autodetectTemplateType("Gemma")).toBe("gemma");
  expect(autodetectTemplateType("gemma-7b")).toBe("gemma");
});

test("autodetectTemplateType returns 'phi2' for Phi-2 models", () => {
  expect(autodetectTemplateType("phi2")).toBe("phi2");
  expect(autodetectTemplateType("Phi2")).toBe("phi2");
  expect(autodetectTemplateType("microsoft-phi2")).toBe("phi2");
});

test("autodetectTemplateType returns 'phind' for Phind models", () => {
  expect(autodetectTemplateType("phind")).toBe("phind");
  expect(autodetectTemplateType("Phind")).toBe("phind");
  expect(autodetectTemplateType("phind-codellama")).toBe("phind");
});

test("autodetectTemplateType returns 'llama2' for general Llama models", () => {
  expect(autodetectTemplateType("llama")).toBe("llama2");
  expect(autodetectTemplateType("Llama")).toBe("llama2");
  expect(autodetectTemplateType("llama2")).toBe("llama2");
  expect(autodetectTemplateType("llama-2")).toBe("llama2");
  expect(autodetectTemplateType("codellama")).toBe("llama2");
});

test("autodetectTemplateType returns 'zephyr' for Zephyr models", () => {
  expect(autodetectTemplateType("zephyr")).toBe("zephyr");
  expect(autodetectTemplateType("Zephyr")).toBe("zephyr");
  expect(autodetectTemplateType("zephyr-7b")).toBe("zephyr");
});

test("autodetectTemplateType returns 'none' for Claude models", () => {
  expect(autodetectTemplateType("claude")).toBe("none");
  expect(autodetectTemplateType("Claude")).toBe("none");
  expect(autodetectTemplateType("claude-3")).toBe("none");
  expect(autodetectTemplateType("claude-3-opus")).toBe("none");
});

test("autodetectTemplateType returns 'none' for Codestral models", () => {
  expect(autodetectTemplateType("codestral")).toBe("none");
  expect(autodetectTemplateType("Codestral")).toBe("none");
  expect(autodetectTemplateType("codestral-22b")).toBe("none");
});

test("autodetectTemplateType returns 'alpaca' for Alpaca and Wizard models", () => {
  expect(autodetectTemplateType("alpaca")).toBe("alpaca");
  expect(autodetectTemplateType("Alpaca")).toBe("alpaca");
  expect(autodetectTemplateType("wizard")).toBe("alpaca");
  expect(autodetectTemplateType("Wizard")).toBe("alpaca");
  expect(autodetectTemplateType("wizardlm")).toBe("alpaca");
});

test("autodetectTemplateType returns 'llama2' for Mistral and Mixtral models", () => {
  expect(autodetectTemplateType("mistral")).toBe("llama2");
  expect(autodetectTemplateType("Mistral")).toBe("llama2");
  expect(autodetectTemplateType("mixtral")).toBe("llama2");
  expect(autodetectTemplateType("Mixtral")).toBe("llama2");
  expect(autodetectTemplateType("mistral-7b")).toBe("llama2");
});

test("autodetectTemplateType returns 'deepseek' for DeepSeek models", () => {
  expect(autodetectTemplateType("deepseek")).toBe("deepseek");
  expect(autodetectTemplateType("DeepSeek")).toBe("deepseek");
  expect(autodetectTemplateType("deepseek-coder")).toBe("deepseek");
});

test("autodetectTemplateType returns 'openchat' for Ninja and OpenChat models", () => {
  expect(autodetectTemplateType("ninja")).toBe("openchat");
  expect(autodetectTemplateType("Ninja")).toBe("openchat");
  expect(autodetectTemplateType("openchat")).toBe("openchat");
  expect(autodetectTemplateType("OpenChat")).toBe("openchat");
});

test("autodetectTemplateType returns 'neural-chat' for Neural Chat models", () => {
  expect(autodetectTemplateType("neural-chat")).toBe("neural-chat");
  expect(autodetectTemplateType("Neural-Chat")).toBe("neural-chat");
  expect(autodetectTemplateType("intel-neural-chat")).toBe("neural-chat");
});

test("autodetectTemplateType returns 'granite' for Granite models", () => {
  expect(autodetectTemplateType("granite")).toBe("granite");
  expect(autodetectTemplateType("granite2:8b")).toBe("granite");
  expect(autodetectTemplateType("Granite")).toBe("granite");
  expect(autodetectTemplateType("granite-code")).toBe("granite");
});

test("autodetectTemplateType returns chatml for other models", () => {
  expect(autodetectTemplateType("unknown-model")).toBe("chatml");
  expect(autodetectTemplateType("random-ai")).toBe("chatml");
  expect(autodetectTemplateType("")).toBe("chatml");
});

test("autodetectTemplateType handles case sensitivity correctly", () => {
  expect(autodetectTemplateType("LLAMA3")).toBe("llama3");
  expect(autodetectTemplateType("gpt-4")).toBe(undefined);
  expect(autodetectTemplateType("GPT-4")).toBe(undefined);
  expect(autodetectTemplateType("CLAUDE")).toBe("none");
});

test("autodetectTemplateType follows correct precedence order", () => {
  // CodeLlama 70B should be detected before general llama
  expect(autodetectTemplateType("codellama-70b")).toBe("codellama-70b");

  // Llama3 should be detected before general llama
  expect(autodetectTemplateType("llama3")).toBe("llama3");

  // General llama should be detected after specific cases
  expect(autodetectTemplateType("llama2")).toBe("llama2");

  // TinyLlama should be detected as zephyr, not llama
  expect(autodetectTemplateType("tinyllama")).toBe("zephyr");
});

test("autodetectTemplateType handles edge cases with special characters", () => {
  expect(autodetectTemplateType("llama-3-8b-instruct")).toBe("llama3");
  expect(autodetectTemplateType("gpt-4-turbo-preview")).toBe(undefined);
  expect(autodetectTemplateType("claude-3-opus-20240229")).toBe("none");
  expect(autodetectTemplateType("mistral-7b-instruct-v0.1")).toBe("llama2");
});

test("autodetectTemplateType handles models with mixed keywords", () => {
  // Should match the first applicable pattern
  expect(autodetectTemplateType("llama3-chat")).toBe("llama3"); // llama3 comes before general patterns
  expect(autodetectTemplateType("gpt-llama")).toBe(undefined); // gpt comes first, returns undefined
  expect(autodetectTemplateType("claude-llama")).toBe("llama2"); // llama comes first, returns llama2
});
