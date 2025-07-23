import { getRuleType, RuleType } from "./getRuleType.js";

describe("getRuleType", () => {
  describe("Always type", () => {
    it("should return Always for rule with no special properties", () => {
      const rule = { rule: "Some rule content" };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should return Always when alwaysApply is true", () => {
      const rule = { rule: "Some rule content", alwaysApply: true };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should return Always when alwaysApply is undefined", () => {
      const rule = { rule: "Some rule content", alwaysApply: undefined };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });
  });

  describe("Auto Attached type", () => {
    it("should return AutoAttached when globs is provided", () => {
      const rule = { rule: "Some rule content", globs: ["*.ts"] };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });

    it("should return AutoAttached when regex is provided", () => {
      const rule = { rule: "Some rule content", regex: "useEffect" };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });

    it("should return AutoAttached when both globs and regex are provided", () => {
      const rule = {
        rule: "Some rule content",
        globs: ["*.tsx"],
        regex: "useState",
      };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });

    it("should prioritize AutoAttached over other types when globs/regex present", () => {
      const rule = {
        rule: "Some rule content",
        globs: ["*.ts"],
        description: "Some description",
        alwaysApply: false,
      };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });

    it("should handle string globs", () => {
      const rule = { rule: "Some rule content", globs: "*.js" };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });

    it("should handle array regex", () => {
      const rule = {
        rule: "Some rule content",
        regex: ["pattern1", "pattern2"],
      };
      expect(getRuleType(rule)).toBe(RuleType.AutoAttached);
    });
  });

  describe("Agent Requested type", () => {
    it("should return AgentRequested when description provided and alwaysApply is false", () => {
      const rule = {
        rule: "Some rule content",
        description: "Helpful for testing",
        alwaysApply: false,
      };
      expect(getRuleType(rule)).toBe(RuleType.AgentRequested);
    });

    it("should not return AgentRequested when description provided but alwaysApply is true", () => {
      const rule = {
        rule: "Some rule content",
        description: "Helpful for testing",
        alwaysApply: true,
      };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should not return AgentRequested when description provided but alwaysApply is undefined", () => {
      const rule = {
        rule: "Some rule content",
        description: "Helpful for testing",
      };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });
  });

  describe("Manual type", () => {
    it("should return Manual when alwaysApply is false and no description", () => {
      const rule = {
        rule: "Some rule content",
        alwaysApply: false,
      };
      expect(getRuleType(rule)).toBe(RuleType.Manual);
    });

    it("should not return Manual when description is provided", () => {
      const rule = {
        rule: "Some rule content",
        alwaysApply: false,
        description: "Some description",
      };
      expect(getRuleType(rule)).toBe(RuleType.AgentRequested);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty rule object", () => {
      const rule = {};
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should handle rule with empty string globs", () => {
      const rule = { rule: "Some rule content", globs: "" };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should handle rule with empty array globs", () => {
      const rule = { rule: "Some rule content", globs: [] };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should handle rule with empty string regex", () => {
      const rule = { rule: "Some rule content", regex: "" };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should handle rule with empty array regex", () => {
      const rule = { rule: "Some rule content", regex: [] };
      expect(getRuleType(rule)).toBe(RuleType.Always);
    });

    it("should handle rule with empty string description", () => {
      const rule = {
        rule: "Some rule content",
        description: "",
        alwaysApply: false,
      };
      expect(getRuleType(rule)).toBe(RuleType.Manual);
    });
  });
});
