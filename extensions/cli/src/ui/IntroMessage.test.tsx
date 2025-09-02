import { AssistantUnrolled } from "@continuedev/config-yaml";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { IntroMessage } from "./IntroMessage.js";

// Mock the MCPService
vi.mock("../services/MCPService.js", () => ({
  MCPService: vi.fn().mockImplementation(() => ({
    getState: () => ({ prompts: [] }),
  })),
}));

// Mock the model capability check
vi.mock("../utils/modelCapability.js", () => ({
  isModelCapable: vi.fn().mockReturnValue(true),
}));

describe("IntroMessage", () => {
  const mockMcpService = {
    getState: () => ({ prompts: [] }),
  } as any;

  const mockModel = {
    provider: "anthropic",
    name: "claude-3-sonnet",
    model: "claude-3-sonnet",
  } as any;

  it("should not duplicate rules from command line", () => {
    // Config with rules that were already injected from command line
    // Hub rules are stored as RuleObject with name and rule fields
    const config: AssistantUnrolled = {
      name: "Test Assistant",
      rules: [
        { name: "nate/spanish", rule: "Always respond in Spanish." },
        "Always be helpful",
      ],
    } as any;

    const { lastFrame } = render(
      <IntroMessage
        config={config}
        model={mockModel}
        mcpService={mockMcpService}
      />,
    );

    const output = lastFrame();

    // Count occurrences of "nate/spanish" in the output
    const matches = output?.match(/nate\/spanish/g) || [];

    // Should appear exactly once, not twice
    expect(matches.length).toBe(1);

    // Verify the slug is shown, not the content
    expect(output).toContain("nate/spanish");
    expect(output).not.toContain("Always respond in Spanish");

    // Verify plain string rule is shown as-is
    expect(output).toContain("Always be helpful");
  });

  it("should display rules from config correctly", () => {
    const config: AssistantUnrolled = {
      name: "Test Assistant",
      rules: ["Rule 1", { name: "Rule 2" }, "Rule 3"],
    } as any;

    const { lastFrame } = render(
      <IntroMessage
        config={config}
        model={mockModel}
        mcpService={mockMcpService}
      />,
    );

    const output = lastFrame();

    expect(output).toContain("Rules:");
    expect(output).toContain("Rule 1");
    expect(output).toContain("Rule 2");
    expect(output).toContain("Rule 3");
  });

  it("should not show Rules section when no rules exist", () => {
    const config: AssistantUnrolled = {
      name: "Test Assistant",
    } as any;

    const { lastFrame } = render(
      <IntroMessage
        config={config}
        model={mockModel}
        mcpService={mockMcpService}
      />,
    );

    const output = lastFrame();

    expect(output).not.toContain("Rules:");
  });

  it("should handle rule objects with missing name property", () => {
    const config: AssistantUnrolled = {
      name: "Test Assistant",
      rules: [
        "String rule",
        { someOtherProp: "value" }, // Missing 'name' property
      ],
    } as any;

    const { lastFrame } = render(
      <IntroMessage
        config={config}
        model={mockModel}
        mcpService={mockMcpService}
      />,
    );

    const output = lastFrame();

    expect(output).toContain("String rule");
    expect(output).toContain("Unknown"); // Should show "Unknown" for objects without name
  });

  it("should display hub rule slugs, not their content", () => {
    const config: AssistantUnrolled = {
      name: "Test Assistant",
      rules: [
        {
          name: "org/complex-rule",
          rule: `---
alwaysApply: true
---

This is a very long rule content that should not be displayed.
It contains multiple lines and complex formatting.
The UI should only show the slug 'org/complex-rule'.`,
        },
        { name: "another/rule", rule: "Short content" },
      ],
    } as any;

    const { lastFrame } = render(
      <IntroMessage
        config={config}
        model={mockModel}
        mcpService={mockMcpService}
      />,
    );

    const output = lastFrame();

    // Should show slugs only
    expect(output).toContain("org/complex-rule");
    expect(output).toContain("another/rule");

    // Should NOT show the rule content
    expect(output).not.toContain("This is a very long rule");
    expect(output).not.toContain("alwaysApply");
    expect(output).not.toContain("Short content");
  });

  it("should handle partial loading gracefully", () => {
    // Test with no config, no model, no mcpService
    const { lastFrame: frame1 } = render(<IntroMessage />);
    let output = frame1();
    expect(output).toContain("Loading...");

    // Test with only model missing
    const config: AssistantUnrolled = {
      name: "Test Assistant",
      rules: ["Rule 1"],
    } as any;

    const { lastFrame: frame2 } = render(
      <IntroMessage config={config} mcpService={mockMcpService} />,
    );
    output = frame2();
    expect(output).toContain("Test Assistant");
    expect(output).toContain("Loading...");
    expect(output).toContain("Rule 1");

    // Test with only config missing
    const { lastFrame: frame3 } = render(
      <IntroMessage model={mockModel} mcpService={mockMcpService} />,
    );
    output = frame3();
    expect(output).toContain("claude-3-sonnet");
    expect(output).not.toContain("Rules:");
  });
});
