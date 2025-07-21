import { PackageIdentifier } from "../interfaces/slugs.js";
import { parseMarkdownRuleOrAssistantUnrolled } from "./unroll.js";

describe("parseMarkdownRuleOrAssistantUnrolled tests", () => {
  it("parses valid YAML content as AssistantUnrolled", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      filePath: "./foo/bar.yaml",
    };
    const yamlContent = `
name: Test Assistant
version: 1.0.0
 
models:
  - name: model
    model: modelname
    provider: ollama
`;
    const result = parseMarkdownRuleOrAssistantUnrolled(yamlContent, mockId);
    expect(result).toHaveProperty("name", "Test Assistant");
    expect(result).toHaveProperty("version", "1.0.0");
    expect(result.models?.length).toBe(1);
    expect(result.models?.[0]).toHaveProperty("name", "model");
  });

  it("parses markdown rule content as AssistantUnrolled", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      filePath: "./foo/bar.md",
    };
    const markdownContent = `
---
name: rulename
description: my rule description
pattern: "**"
---
This is the rule 
`;
    const result = parseMarkdownRuleOrAssistantUnrolled(
      markdownContent,
      mockId,
    );
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("version");
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules).toBeDefined();
    expect(result.rules!.length).toBe(1);
    const rule = result.rules![0];
    expect(rule).toHaveProperty("name", "rulename");
    expect(rule).toHaveProperty("description", "my rule description");
    expect(rule).toHaveProperty("globs", "./foo/**/*");
    expect(rule).toHaveProperty("rule", "This is the rule");
  });

  it("throws error for invalid content in yaml file", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      filePath: "./foo/bar.yaml",
    };
    const invalidContent = `
name: Test Assistant
version: 1.0.0
 
model: # should be models
  - name: model
    model: modelname
    provider: ollama
`;
    expect(() =>
      parseMarkdownRuleOrAssistantUnrolled(invalidContent, mockId),
    ).toThrow();
  });

  it("Every non-YAML file is a rule", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      filePath: "./foo/bar",
    };
    const dubiousContent = `This is not \nproper #YAML#`;
    const result = parseMarkdownRuleOrAssistantUnrolled(dubiousContent, mockId);
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("version");
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules).toBeDefined();
    expect(result.rules!.length).toBe(1);
    const rule = result.rules![0];
    expect(rule).toHaveProperty("name", "foo/bar");
    expect(rule).toHaveProperty("globs", "./foo/**/*");
    expect(rule).toHaveProperty("rule", dubiousContent);
  });
});
