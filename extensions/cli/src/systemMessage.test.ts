import { describe, expect, it, vi } from "vitest";

// Use the actual implementation instead of the mocked one
vi.unmock("./systemMessage.js");
const { constructSystemMessage } = await import("./systemMessage.js");

// Mock the service container to avoid "No factory registered for service 'config'" error
vi.mock("./services/ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn().mockResolvedValue({ config: { rules: [] } }),
    set: vi.fn(),
  },
}));

// Mock processRule to avoid file system operations in tests
vi.mock("./hubLoader.js", () => ({
  processRule: vi
    .fn()
    .mockImplementation((spec: string) => Promise.resolve(spec)),
}));

// The first lines of the shared turn texts (core/llm/prompts/turns.ts)
const PLAN_MODE_STRING = "You are in plan mode.";
const AGENT_MODE_STRING = "You are in agent mode.";

describe("constructSystemMessage", () => {
  it("should return base system message with rules when additionalRules is provided", async () => {
    const rules = ["These are the rules for the assistant."];
    const result = await constructSystemMessage("normal", rules);

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rules[0]);
    expect(result).toContain("</context>");
  });

  it("should return base system message with agent content when no rules but agent file exists", async () => {
    // The implementation checks for agent files like AGENTS.md which exists in this project
    const result = await constructSystemMessage("normal");

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain("AGENTS.md");
  });

  it("should include base system message components", async () => {
    const result = await constructSystemMessage("normal");

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain("<env>");
    expect(result).toContain("Platform:");
  });

  it("keeps the facts that change between runs out of the cached prefix", async () => {
    // The date and the git status go in the first user message instead
    // (src/environmentContext.ts), so two sessions in the same folder share
    // the system checkpoint of the prompt cache.
    const result = await constructSystemMessage("normal");

    expect(result).not.toContain("Today's date:");
    expect(result).not.toContain('<context name="gitStatus">');
    expect(result).not.toContain("git status at the start of the conversation");
    expect(result).toContain('<context name="environment">');
  });

  it("gives a Qwen model the short turn text and others the full one", async () => {
    const qwenPlan = await constructSystemMessage(
      "plan",
      undefined,
      undefined,
      false,
      "qwen.qwen3-coder-30b-a3b-v1:0",
    );
    expect(qwenPlan).toContain("do not make a task list");
    expect(qwenPlan).toContain("End by calling PresentPlan, then stop");
    const qwenAct = await constructSystemMessage(
      "normal",
      undefined,
      undefined,
      false,
      "qwen3.8-flash-next-nvfp4-nvfp4",
    );
    expect(qwenAct).toContain("Keep going until the request is done");
    const claude = await constructSystemMessage(
      "plan",
      undefined,
      undefined,
      false,
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    );
    expect(claude).toContain("Two kinds of unknowns");
    expect(claude).not.toContain("do not make a task list");
  });

  it("is the same text for two calls in the same process", async () => {
    expect(await constructSystemMessage("normal")).toBe(
      await constructSystemMessage("normal"),
    );
  });

  it("should handle whitespace-only rules message", async () => {
    const result = await constructSystemMessage("normal", ["   "]);

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain('<context name="userRules">');
  });

  it("should include working directory information", async () => {
    const result = await constructSystemMessage("normal");

    expect(result).toContain("Working directory:");
    expect(result).toContain("<env>");
  });

  it("should include platform information", async () => {
    const result = await constructSystemMessage("normal");

    expect(result).toContain("Platform:");
  });

  it("should format rules section correctly", async () => {
    const rulesMessage = "Rule 1: Do this\nRule 2: Do that";
    const result = await constructSystemMessage("normal", [rulesMessage]);

    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain("</context>");
  });

  it("should handle multiline rules message", async () => {
    const rulesMessage = `Rule 1: First rule
Rule 2: Second rule
Rule 3: Third rule`;
    const result = await constructSystemMessage("normal", [rulesMessage]);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain("</context>");
  });

  it("should handle special characters in rules message", async () => {
    const rulesMessage = "Rule with <special> characters & symbols!";
    const result = await constructSystemMessage("normal", [rulesMessage]);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it("should handle very long rules message", async () => {
    const rulesMessage = "A".repeat(1000);
    const result = await constructSystemMessage("normal", [rulesMessage]);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it("should combine rules and agent content when both are present", async () => {
    const rulesMessage = "These are the rules.";
    const result = await constructSystemMessage("normal", [rulesMessage]);

    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain("AGENTS.md");
    expect(result).toContain("</context>");
  });

  it("should add headless mode instructions when headless is true", async () => {
    const result = await constructSystemMessage(
      "normal",
      undefined,
      undefined,
      true,
    );

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain("IMPORTANT: You are running in headless mode");
    expect(result).toContain("Provide ONLY your final answer");
    expect(result).toContain(
      "Do not include explanations, reasoning, or additional commentary",
    );
  });

  it("should not add headless mode instructions when headless is false", async () => {
    const result = await constructSystemMessage(
      "normal",
      undefined,
      undefined,
      false,
    );

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).not.toContain("IMPORTANT: You are running in headless mode");
    expect(result).not.toContain("Provide ONLY your final answer");
  });

  it("should not add headless mode instructions when headless is undefined", async () => {
    const result = await constructSystemMessage("normal");

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).not.toContain("IMPORTANT: You are running in headless mode");
    expect(result).not.toContain("Provide ONLY your final answer");
  });

  it("should add JSON format instructions when format is json", async () => {
    const result = await constructSystemMessage("normal", undefined, "json");

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain(
      "IMPORTANT: You are operating in JSON output mode",
    );
    expect(result).toContain("Your final response MUST be valid JSON");
    expect(result).toContain("JSON.parse()");
  });

  it("should add plan mode instructions when mode is plan", async () => {
    const result = await constructSystemMessage(
      "plan",
      undefined,
      undefined,
      false,
    );

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).toContain(PLAN_MODE_STRING);
    expect(result).toContain("the person decides whether to do it");
    expect(result).toContain("Your tools only read");
    // The CLI's own tool name, not the IDE's
    expect(result).toContain("call PresentPlan and stop");
    expect(result).not.toContain("present_plan");
    expect(result).not.toContain(AGENT_MODE_STRING);
  });

  it("should not add plan mode instructions when mode is not plan", async () => {
    const result = await constructSystemMessage(
      "normal",
      undefined,
      undefined,
      false,
    );

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).not.toContain(PLAN_MODE_STRING);
    expect(result).toContain(AGENT_MODE_STRING);
  });

  it("should not add plan mode instructions when mode is normal", async () => {
    const result = await constructSystemMessage("normal");

    expect(result).toContain("You are an agent in the Continuous CLI");
    expect(result).not.toContain(PLAN_MODE_STRING);
    expect(result).toContain(AGENT_MODE_STRING);
    // The act turn's rules against listing steps and stopping
    expect(result).toContain("A reply with no tool call ends your turn");
    expect(result).toContain("TaskList tool");
  });

  it("should include basic plan mode description", async () => {
    const result = await constructSystemMessage(
      "plan",
      undefined,
      undefined,
      false,
    );

    expect(result).toContain(PLAN_MODE_STRING);
    expect(result).toContain("Your tools only read");
    expect(result).toContain("Two kinds of unknowns");
  });

  it("should combine plan mode with headless mode instructions", async () => {
    const result = await constructSystemMessage(
      "plan",
      undefined,
      undefined,
      true,
    );

    expect(result).toContain("IMPORTANT: You are running in headless mode");
    expect(result).toContain(PLAN_MODE_STRING);
    expect(result).toContain("the person decides whether to do it");
  });

  it("should combine plan mode with JSON format instructions", async () => {
    const result = await constructSystemMessage(
      "plan",
      undefined,
      "json",
      false,
    );

    expect(result).toContain(
      "IMPORTANT: You are operating in JSON output mode",
    );
    expect(result).toContain(PLAN_MODE_STRING);
    expect(result).toContain("the person decides whether to do it");
  });
});
