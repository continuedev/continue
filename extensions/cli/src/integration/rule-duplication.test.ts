import { AssistantUnrolled } from "@continuedev/config-yaml";
import { describe, expect, it, vi } from "vitest";

import { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import { ConfigEnhancer } from "../configEnhancer.js";

// Mock the processRule function to avoid network calls
vi.mock("../hubLoader.js", () => ({
  processRule: vi.fn((rule: string) => {
    // Simulate hub slug loading - return content for hub slugs
    if (rule.includes("/") && !rule.startsWith(".") && !rule.startsWith("/")) {
      return Promise.resolve(`Content for ${rule}`);
    }
    // Return as-is for direct content
    return Promise.resolve(rule);
  }),
  loadPackagesFromHub: vi.fn(() => Promise.resolve([])),
  mcpProcessor: {},
  modelProcessor: {},
}));

describe("Rule duplication integration test", () => {
  it("should not duplicate rules when using --rule flag", async () => {
    const enhancer = new ConfigEnhancer();

    // Initial config without any rules
    const initialConfig: AssistantUnrolled = {
      name: "Test Assistant",
      rules: [],
    } as any;

    // Simulate command-line options with --rule flag
    const options: BaseCommandOptions = {
      rule: ["nate/spanish"],
    };

    // Enhance config with command-line rules
    const enhancedConfig = await enhancer.enhanceConfig(initialConfig, options);

    // Verify the rule was added exactly once as a RuleObject
    expect(enhancedConfig.rules).toHaveLength(1);
    expect(enhancedConfig.rules).toEqual([
      { name: "nate/spanish", rule: "Content for nate/spanish" },
    ]);
  });

  it("should merge command-line rules with existing config rules", async () => {
    const enhancer = new ConfigEnhancer();

    // Initial config with existing rules
    const initialConfig: AssistantUnrolled = {
      name: "Test Assistant",
      rules: ["existing-rule"],
    } as any;

    // Simulate command-line options with --rule flag
    const options: BaseCommandOptions = {
      rule: ["nate/spanish", "direct-rule"],
    };

    // Enhance config with command-line rules
    const enhancedConfig = await enhancer.enhanceConfig(initialConfig, options);

    // Verify all rules are present without duplication
    expect(enhancedConfig.rules).toHaveLength(3);
    expect(enhancedConfig.rules).toEqual([
      "existing-rule",
      { name: "nate/spanish", rule: "Content for nate/spanish" },
      "direct-rule",
    ]);
  });

  it("should handle rule content with frontmatter", async () => {
    const enhancer = new ConfigEnhancer();

    // Mock processRule to return content with frontmatter
    const { processRule } = await import("../hubLoader.js");
    (processRule as any).mockImplementation((rule: string) => {
      if (rule === "nate/spanish") {
        return Promise.resolve(`---
alwaysApply: true
---

Always respond in Spanish.`);
      }
      return Promise.resolve(rule);
    });

    const initialConfig: AssistantUnrolled = {
      name: "Test Assistant",
      rules: [],
    } as any;

    const options: BaseCommandOptions = {
      rule: ["nate/spanish"],
    };

    const enhancedConfig = await enhancer.enhanceConfig(initialConfig, options);

    // Hub rules should be stored as RuleObject with name and content
    expect(enhancedConfig.rules).toHaveLength(1);
    const ruleObj = enhancedConfig.rules?.[0] as any;
    expect(ruleObj.name).toBe("nate/spanish");
    expect(ruleObj.rule).toContain("Always respond in Spanish.");
    expect(ruleObj.rule).toContain("alwaysApply: true");
  });
});
