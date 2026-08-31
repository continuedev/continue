import { expect, test } from "vitest";

import { ModelDescription } from "../index.js";
import { modelSupportsNativeTools } from "./toolSupport.js";

function model(overrides: Partial<ModelDescription> = {}): ModelDescription {
  return {
    title: "Claude Code",
    provider: "claudecode",
    model: "claude-opus-4-5",
    ...overrides,
  } as ModelDescription;
}

// Regression: with claudecode absent from PROVIDER_TOOL_SUPPORT this returned
// false, so streamNormalInput never set completionOptions.tools. ClaudeCodeCli
// passes exactly that list to registerToolsForSession, so the spawned `claude`
// process saw only the force-included shadow_* tools - every other tool was
// described in the system prompt but rejected as "No such tool available".
test("modelSupportsNativeTools returns true for the claudecode provider", () => {
  expect(modelSupportsNativeTools(model())).toBe(true);
});

test("modelSupportsNativeTools respects an explicit capabilities override for claudecode", () => {
  expect(
    modelSupportsNativeTools(model({ capabilities: { tools: false } })),
  ).toBe(false);
});

test("modelSupportsNativeTools returns true for claudecode regardless of model name", () => {
  expect(modelSupportsNativeTools(model({ model: "" }))).toBe(true);
  expect(modelSupportsNativeTools(model({ model: "sonnet" }))).toBe(true);
});
