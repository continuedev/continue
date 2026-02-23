import { PackageIdentifier } from "../interfaces/slugs.js";
import {
  fillTemplateVariables,
  getTemplateVariables,
  parseMarkdownRuleOrAssistantUnrolled,
  replaceInputsWithSecrets,
} from "./unroll.js";

describe("parseMarkdownRuleOrAssistantUnrolled tests", () => {
  it("parses valid YAML content as AssistantUnrolled", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "./foo/bar.yaml",
    };
    const yamlContent = `
name: Test Agent
version: 1.0.0
 
models:
  - name: model
    model: modelname
    provider: ollama
`;
    const result = parseMarkdownRuleOrAssistantUnrolled(yamlContent, mockId);
    expect(result).toHaveProperty("name", "Test Agent");
    expect(result).toHaveProperty("version", "1.0.0");
    expect(result.models?.length).toBe(1);
    expect(result.models?.[0]).toHaveProperty("name", "model");
  });

  it("parses markdown rule content as AssistantUnrolled", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "./foo/bar.md",
    };
    const markdownContent = `
---
name: rulename
description: my rule description
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
    expect(rule).toHaveProperty("globs", undefined);
    expect(rule).toHaveProperty("rule", "This is the rule");
  });

  it("throws error for invalid content in yaml file", () => {
    const mockId: PackageIdentifier = {
      uriType: "file",
      fileUri: "./foo/bar.yaml",
    };
    const invalidContent = `
name: Test Agent
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
      fileUri: "file:///foo/bar",
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
    expect(rule).toHaveProperty("globs", undefined);
    expect(rule).toHaveProperty("rule", dubiousContent);
  });
});

describe("replaceInputsWithSecrets tests", () => {
  it("replaces single input with secret", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  value: \${{ inputs.apiKey }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.apiKey }}");
    expect(result).not.toContain("\${{ inputs.apiKey }}");
  });

  it("replaces multiple inputs with secrets", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  apiKey: \${{ inputs.apiKey }}
  dbPassword: \${{ inputs.dbPassword }}
  endpoint: \${{ inputs.endpoint }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.apiKey }}");
    expect(result).toContain("\${{ secrets.dbPassword }}");
    expect(result).toContain("\${{ secrets.endpoint }}");
    expect(result).not.toContain("\${{ inputs.apiKey }}");
    expect(result).not.toContain("\${{ inputs.dbPassword }}");
    expect(result).not.toContain("\${{ inputs.endpoint }}");
  });

  it("leaves secrets template variables unchanged", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  apiKey: \${{ secrets.existingSecret }}
  dbPassword: \${{ inputs.dbPassword }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.existingSecret }}");
    expect(result).toContain("\${{ secrets.dbPassword }}");
    expect(result).not.toContain("\${{ inputs.dbPassword }}");
  });

  it("leaves other template variables unchanged", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  apiKey: \${{ inputs.apiKey }}
  environment: \${{ continue.environment }}
  customVar: \${{ other.variable }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.apiKey }}");
    expect(result).toContain("\${{ continue.environment }}");
    expect(result).toContain("\${{ other.variable }}");
    expect(result).not.toContain("\${{ inputs.apiKey }}");
  });

  it("handles yaml with no input template variables", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  staticValue: "hello world"
  secretValue: \${{ secrets.mySecret }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toBe(yamlContent); // Should remain unchanged
    expect(result).toContain("\${{ secrets.mySecret }}");
  });

  it("handles empty string", () => {
    const yamlContent = "";
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toBe("");
  });

  it("handles inputs with whitespace in template variables", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  value1: \${{  inputs.apiKey  }}
  value2: \${{\tinputs.tabbed\t}}
  value3: \${{\n  inputs.multiline  \n}}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.apiKey }}");
    expect(result).toContain("\${{ secrets.tabbed }}");
    expect(result).toContain("\${{ secrets.multiline }}");
    expect(result).not.toContain("inputs.apiKey");
    expect(result).not.toContain("inputs.tabbed");
    expect(result).not.toContain("inputs.multiline");
  });

  it("handles nested input keys", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  config: \${{ inputs.database.host }}
  port: \${{ inputs.database.port }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.database.host }}");
    expect(result).toContain("\${{ secrets.database.port }}");
    expect(result).not.toContain("inputs.database.host");
    expect(result).not.toContain("inputs.database.port");
  });

  it("handles multiple inputs on same line", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  connectionString: "host=\${{ inputs.host }};port=\${{ inputs.port }};user=\${{ inputs.user }}"
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.host }}");
    expect(result).toContain("\${{ secrets.port }}");
    expect(result).toContain("\${{ secrets.user }}");
    expect(result).not.toContain("inputs.host");
    expect(result).not.toContain("inputs.port");
    expect(result).not.toContain("inputs.user");
  });

  it("preserves malformed template variables that don't start with inputs", () => {
    const yamlContent = `
name: Test
version: 1.0.0
data:
  value1: \${{ inputs.valid }}
  value2: \${{ malformed.inputs.something }}
  value3: \${{ input.typo }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    expect(result).toContain("\${{ secrets.valid }}");
    expect(result).toContain("\${{ malformed.inputs.something }}"); // Should remain unchanged
    expect(result).toContain("\${{ input.typo }}"); // Should remain unchanged (typo in 'input')
    expect(result).not.toContain("inputs.valid");
  });

  it("handles YAML with complex structure", () => {
    const yamlContent = `
name: Complex Test
version: 1.0.0
models:
  - name: gpt-4
    apiKey: \${{ inputs.openaiKey }}
prompts:
  - name: system
    content: "You are a helpful assistant. API key: \${{ inputs.openaiKey }}"
rules:
  - "Use \${{ inputs.style }} formatting"
data:
  config:
    database:
      host: \${{ inputs.dbHost }}
      password: \${{ inputs.dbPassword }}
    external:
      secret: \${{ secrets.external }}
      other: \${{ other.variable }}
`;
    const result = replaceInputsWithSecrets(yamlContent);
    // Check all inputs were replaced with secrets
    expect(result).toContain("\${{ secrets.openaiKey }}");
    expect(result).toContain("\${{ secrets.style }}");
    expect(result).toContain("\${{ secrets.dbHost }}");
    expect(result).toContain("\${{ secrets.dbPassword }}");
    // Check that non-input variables remain unchanged
    expect(result).toContain("\${{ secrets.external }}");
    expect(result).toContain("\${{ other.variable }}");
    // Check that no input variables remain
    expect(result).not.toContain("inputs.openaiKey");
    expect(result).not.toContain("inputs.style");
    expect(result).not.toContain("inputs.dbHost");
    expect(result).not.toContain("inputs.dbPassword");
  });
});

describe("getTemplateVariables edge cases", () => {
  it("handles undefined input gracefully", () => {
    const result = getTemplateVariables(undefined as any);
    expect(result).toEqual([]);
  });

  it("handles null input gracefully", () => {
    const result = getTemplateVariables(null as any);
    expect(result).toEqual([]);
  });

  it("handles non-string input gracefully", () => {
    const result = getTemplateVariables(123 as any);
    expect(result).toEqual([]);
  });

  it("handles empty string correctly", () => {
    const result = getTemplateVariables("");
    expect(result).toEqual([]);
  });

  it("extracts template variables from valid input", () => {
    const result = getTemplateVariables("\${{ secrets.apiKey }}");
    expect(result).toEqual(["secrets.apiKey"]);
  });

  it("extracts multiple template variables", () => {
    const result = getTemplateVariables(
      "\${{ secrets.key1 }} and \${{ inputs.key2 }}",
    );
    expect(result).toContain("secrets.key1");
    expect(result).toContain("inputs.key2");
    expect(result.length).toBe(2);
  });
});

describe("fillTemplateVariables edge cases", () => {
  it("handles undefined input gracefully", () => {
    const result = fillTemplateVariables(undefined as any, {});
    expect(result).toBe("");
  });

  it("handles null input gracefully", () => {
    const result = fillTemplateVariables(null as any, {});
    expect(result).toBe("");
  });

  it("handles non-string input gracefully", () => {
    const result = fillTemplateVariables(123 as any, {});
    expect(result).toBe("");
  });

  it("handles empty string correctly", () => {
    const result = fillTemplateVariables("", {});
    expect(result).toBe("");
  });

  it("fills template variables with valid input", () => {
    const result = fillTemplateVariables("\${{ secrets.apiKey }}", {
      "secrets.apiKey": "my-secret-key",
    });
    expect(result).toBe("my-secret-key");
  });

  it("leaves unfilled variables unchanged", () => {
    const result = fillTemplateVariables("\${{ secrets.apiKey }}", {});
    expect(result).toBe("\${{ secrets.apiKey }}");
  });
});
