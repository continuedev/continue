import { parse } from "yaml";

import { updateAnthropicModelInYaml } from "./yamlConfigUpdater.js";

describe("updateAnthropicModelInYaml", () => {
  const testApiKey = "sk-ant-test123456789";

  describe("empty or invalid input", () => {
    it("should create new config from empty string", () => {
      const result = updateAnthropicModelInYaml("", testApiKey);

      expect(result).toContain("name: Local Config");
      expect(result).toContain("version: 1.0.0");
      expect(result).toContain("schema: v1");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });

    it("should create new config from invalid YAML", () => {
      const invalidYaml = "invalid: [yaml content";
      const result = updateAnthropicModelInYaml(invalidYaml, testApiKey);

      expect(result).toContain("name: Local Config");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });
  });

  describe("comment preservation", () => {
    it("should preserve comments when adding new model", () => {
      const yamlWithComments = `# My Continue config
name: Local Config
version: 1.0.0
schema: v1
# List of available models
models:
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(yamlWithComments, testApiKey);

      expect(result).toContain("# My Continue config");
      expect(result).toContain("# List of available models");
      expect(result).toContain("uses: openai/gpt-4");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });

    it("should preserve comments when updating existing model", () => {
      const yamlWithComments = `# My Continue config
name: Local Config
version: 1.0.0
schema: v1
# List of available models
models:
  - uses: anthropic/claude-sonnet-4-5
    with:
      ANTHROPIC_API_KEY: old-key
`;

      const result = updateAnthropicModelInYaml(yamlWithComments, testApiKey);

      expect(result).toContain("# My Continue config");
      expect(result).toContain("# List of available models");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
      expect(result).not.toContain("old-key");
    });
  });

  describe("model management", () => {
    it("should add new anthropic model when none exists", () => {
      const existingConfig = `name: Local Config
version: 1.0.0
schema: v1
models:
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(existingConfig, testApiKey);

      expect(result).toContain("uses: openai/gpt-4");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
      expect(result).toContain("OPENAI_API_KEY: TEST-openai-test");
    });

    it("should update existing anthropic model", () => {
      const existingConfig = `name: Local Config
version: 1.0.0
schema: v1
models:
  - uses: anthropic/claude-sonnet-4-5
    with:
      ANTHROPIC_API_KEY: old-anthropic-key
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(existingConfig, testApiKey);

      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("uses: openai/gpt-4");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
      expect(result).toContain("OPENAI_API_KEY: TEST-openai-test");
      expect(result).not.toContain("old-anthropic-key");

      // Should only have one anthropic model
      const anthropicMatches = result.match(
        /uses: anthropic\/claude-sonnet-4-5/g,
      );
      expect(anthropicMatches).toHaveLength(1);
    });

    it("should handle config with no models array", () => {
      const configWithoutModels = `name: Local Config
version: 1.0.0
schema: v1
`;

      const result = updateAnthropicModelInYaml(
        configWithoutModels,
        testApiKey,
      );

      expect(result).toContain("name: Local Config");
      expect(result).toContain("models:");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });

    it("should handle config with empty models array", () => {
      const configWithEmptyModels = `name: Local Config
version: 1.0.0
schema: v1
models: []
`;

      const result = updateAnthropicModelInYaml(
        configWithEmptyModels,
        testApiKey,
      );

      expect(result).toContain("name: Local Config");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });
  });

  describe("structure validation", () => {
    it("should produce valid YAML that can be parsed", () => {
      const input = `# Test config
name: Test
models:
  - uses: existing/model
`;

      const result = updateAnthropicModelInYaml(input, testApiKey);

      // Should not throw when parsing
      expect(() => {
        parse(result);
      }).not.toThrow();
    });

    it("should maintain proper YAML structure", () => {
      const result = updateAnthropicModelInYaml("", testApiKey);

      expect(result).toMatch(/^name: /m);
      expect(result).toMatch(/^version: /m);
      expect(result).toMatch(/^schema: /m);
      expect(result).toMatch(/^models:/m);
      expect(result).toMatch(/^\s+- uses: /m);
      expect(result).toMatch(/^\s+with:/m);
      expect(result).toMatch(/^\s+ANTHROPIC_API_KEY: /m);
    });
  });

  describe("edge cases", () => {
    it("should handle malformed models array gracefully", () => {
      const malformedConfig = `name: Local Config
models: "not an array"
`;

      const result = updateAnthropicModelInYaml(malformedConfig, testApiKey);

      expect(result).toContain("uses: anthropic/claude-sonnet-4-5");
      expect(result).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
    });

    it("should handle different API key formats", () => {
      const differentKeys = [
        "sk-ant-1234567890",
        "sk-ant-abcdefghijklmnop",
        "sk-ant-test-key-with-dashes",
      ];

      differentKeys.forEach((key) => {
        const result = updateAnthropicModelInYaml("", key);
        expect(result).toContain(`ANTHROPIC_API_KEY: ${key}`);
      });
    });
  });
});
