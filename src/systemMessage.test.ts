import { constructSystemMessage } from "./systemMessage.js";

describe("constructSystemMessage", () => {
  it("should return base system message with rules when rulesSystemMessage is provided", async () => {
    const rulesMessage = "These are the rules for the assistant.";
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain("</context>");
  });

  it("should return base system message with agent content when no rules but agent file exists", async () => {
    // The implementation checks for agent files like AGENTS.md which exists in this project
    const result = await constructSystemMessage("");

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain("AGENTS.md");
  });

  it("should include base system message components", async () => {
    const result = await constructSystemMessage("");

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).toContain("<env>");
    expect(result).toContain('<context name="directoryStructure">');
    expect(result).toContain('<context name="gitStatus">');
  });

  it("should handle whitespace-only rules message", async () => {
    const result = await constructSystemMessage("   ");

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).toContain('<context name="userRules">');
  });

  it("should include working directory information", async () => {
    const result = await constructSystemMessage("");

    expect(result).toContain("Working directory:");
    expect(result).toContain("<env>");
  });

  it("should include platform information", async () => {
    const result = await constructSystemMessage("");

    expect(result).toContain("Platform:");
  });

  it("should include current date", async () => {
    const result = await constructSystemMessage("");

    expect(result).toContain("Today's date:");
    expect(result).toContain(new Date().toISOString().split("T")[0]);
  });

  it("should format rules section correctly", async () => {
    const rulesMessage = "Rule 1: Do this\nRule 2: Do that";
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain("</context>");
  });

  it("should handle multiline rules message", async () => {
    const rulesMessage = `Rule 1: First rule
Rule 2: Second rule
Rule 3: Third rule`;
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
    expect(result).toContain("</context>");
  });

  it("should handle special characters in rules message", async () => {
    const rulesMessage = "Rule with <special> characters & symbols!";
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it("should handle very long rules message", async () => {
    const rulesMessage = "A".repeat(1000);
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain(rulesMessage);
    expect(result).toContain('<context name="userRules">');
  });

  it("should combine rules and agent content when both are present", async () => {
    const rulesMessage = "These are the rules.";
    const result = await constructSystemMessage(rulesMessage);

    expect(result).toContain('<context name="userRules">');
    expect(result).toContain(rulesMessage);
    expect(result).toContain("AGENTS.md");
    expect(result).toContain("</context>");
  });

  it("should add headless mode instructions when headless is true", async () => {
    const result = await constructSystemMessage("", undefined, undefined, true);

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).toContain("IMPORTANT: You are running in headless mode");
    expect(result).toContain("Provide ONLY your final answer");
    expect(result).toContain("Do not include explanations, reasoning, or additional commentary");
  });

  it("should not add headless mode instructions when headless is false", async () => {
    const result = await constructSystemMessage("", undefined, undefined, false);

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).not.toContain("IMPORTANT: You are running in headless mode");
    expect(result).not.toContain("Provide ONLY your final answer");
  });

  it("should not add headless mode instructions when headless is undefined", async () => {
    const result = await constructSystemMessage("");

    expect(result).toContain("You are an agent in the Continue CLI");
    expect(result).not.toContain("IMPORTANT: You are running in headless mode");
    expect(result).not.toContain("Provide ONLY your final answer");
  });
});
