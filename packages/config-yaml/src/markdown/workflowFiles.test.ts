import {
  parseWorkflowFile,
  serializeWorkflowFile,
  type WorkflowFile,
} from "./workflowFiles.js";

const example = `
---
name: Example Agent / Workflow
description: Trying to wrap my head around what are these files
model: anthropic/claude-sonnet-4
tools: linear-mcp, sentry-mcp:read-alerts, Read, Glob, Bash(git diff:*)
rules: org/rule1, org/rule2
---
This is the prompt
`.trim();

const minimalExample = `
---
name: Minimal Workflow
---
Just a simple prompt
`.trim();

const invalidExample = `
---
description: Missing name field
---
This should fail
`.trim();

const noFrontmatterExample = `This is just markdown without frontmatter`;

const invalidYamlExample = `
---
name: [invalid: yaml: syntax
---
This should fail
`.trim();

describe("parseWorkflowFile", () => {
  test("parses complete workflow file correctly", () => {
    const result = parseWorkflowFile(example);

    expect(result).toEqual({
      name: "Example Agent / Workflow",
      description: "Trying to wrap my head around what are these files",
      model: "anthropic/claude-sonnet-4",
      tools: "linear-mcp, sentry-mcp:read-alerts, Read, Glob, Bash(git diff:*)",
      rules: "org/rule1, org/rule2",
      prompt: "This is the prompt",
    });
  });

  test("parses minimal workflow file with only name", () => {
    const result = parseWorkflowFile(minimalExample);

    expect(result).toEqual({
      name: "Minimal Workflow",
      prompt: "Just a simple prompt",
    });

    // Optional fields should be undefined
    expect(result.description).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.tools).toBeUndefined();
    expect(result.rules).toBeUndefined();
  });

  test("throws error when name field is missing", () => {
    expect(() => parseWorkflowFile(invalidExample)).toThrow(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("throws error when no frontmatter is present", () => {
    expect(() => parseWorkflowFile(noFrontmatterExample)).toThrow(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("throws error with invalid YAML syntax", () => {
    expect(() => parseWorkflowFile(invalidYamlExample)).toThrow();
  });

  test("handles empty frontmatter with name", () => {
    const emptyFrontmatter = `
---
name: Empty Test
---
`.trim();

    const result = parseWorkflowFile(emptyFrontmatter);
    expect(result).toEqual({
      name: "Empty Test",
      prompt: "",
    });
  });

  test("handles multiline prompts", () => {
    const multilineExample = `
---
name: Multiline Test
---
Line 1
Line 2

Line 4 with gap
`.trim();

    const result = parseWorkflowFile(multilineExample);
    expect(result.prompt).toBe("Line 1\nLine 2\n\nLine 4 with gap");
  });

  test("handles prompts with --- in content", () => {
    const dashedContentExample = `
---
name: Dashed Content
---
This has --- in the middle
And more content after
`.trim();

    const result = parseWorkflowFile(dashedContentExample);
    expect(result.prompt).toBe(
      "This has --- in the middle\nAnd more content after",
    );
  });

  test("validates unknown frontmatter fields are allowed", () => {
    const extraFieldsExample = `
---
name: Extra Fields Test
extraField: should be ignored by schema
---
Prompt content
`.trim();

    const result = parseWorkflowFile(extraFieldsExample);
    expect(result.name).toBe("Extra Fields Test");
    expect(result.prompt).toBe("Prompt content");
    // Extra fields should not be in the result
    expect("extraField" in result).toBe(false);
  });

  test("parses workflow with tools but no rules", () => {
    const toolsOnlyExample = `
---
name: Tools Only Workflow
description: A workflow that uses tools but no rules
tools: git, filesystem, search
---
This workflow uses tools but doesn't define any rules.
`.trim();

    const result = parseWorkflowFile(toolsOnlyExample);
    expect(result).toEqual({
      name: "Tools Only Workflow",
      description: "A workflow that uses tools but no rules",
      tools: "git, filesystem, search",
      prompt: "This workflow uses tools but doesn't define any rules.",
    });

    // Rules should be undefined
    expect(result.rules).toBeUndefined();
  });

  test("validates required name field type", () => {
    const invalidNameType = `
---
name: 123
---
Prompt
`.trim();

    expect(() => parseWorkflowFile(invalidNameType)).toThrow(
      "Invalid workflow file frontmatter",
    );
  });
});

describe("serializeWorkflowFile", () => {
  test("serializes complete workflow file correctly", () => {
    const workflowFile: WorkflowFile = {
      name: "Test Workflow",
      description: "A test workflow",
      model: "anthropic/claude-3-sonnet",
      tools: "tool1, tool2",
      rules: "rule1, rule2",
      prompt: "This is the test prompt",
    };

    const result = serializeWorkflowFile(workflowFile);

    // Parse it back to verify round-trip consistency
    const parsed = parseWorkflowFile(result);
    expect(parsed).toEqual(workflowFile);
  });

  test("serializes minimal workflow file", () => {
    const workflowFile: WorkflowFile = {
      name: "Minimal",
      prompt: "Simple prompt",
    };

    const result = serializeWorkflowFile(workflowFile);
    const parsed = parseWorkflowFile(result);
    expect(parsed).toEqual(workflowFile);
  });

  test("filters out undefined values from frontmatter", () => {
    const workflowFile: WorkflowFile = {
      name: "Test",
      description: undefined,
      model: "gpt-4",
      tools: undefined,
      rules: undefined,
      prompt: "Test prompt",
    };

    const result = serializeWorkflowFile(workflowFile);

    // Should not contain undefined fields in YAML
    expect(result).not.toContain("description");
    expect(result).not.toContain("tools");
    expect(result).not.toContain("rules");
    expect(result).toContain("model: gpt-4");

    // Verify round-trip
    const parsed = parseWorkflowFile(result);
    expect(parsed.name).toBe("Test");
    expect(parsed.model).toBe("gpt-4");
    expect(parsed.description).toBeUndefined();
    expect(parsed.tools).toBeUndefined();
    expect(parsed.rules).toBeUndefined();
  });

  test("handles empty prompt", () => {
    const workflowFile: WorkflowFile = {
      name: "Empty Prompt",
      prompt: "",
    };

    const result = serializeWorkflowFile(workflowFile);
    const parsed = parseWorkflowFile(result);
    expect(parsed.prompt).toBe("");
  });

  test("preserves multiline prompts", () => {
    const workflowFile: WorkflowFile = {
      name: "Multiline",
      prompt: "Line 1\nLine 2\n\nLine 4",
    };

    const result = serializeWorkflowFile(workflowFile);
    const parsed = parseWorkflowFile(result);
    expect(parsed.prompt).toBe(workflowFile.prompt);
  });
});

describe("round-trip consistency", () => {
  test("example workflow maintains consistency", () => {
    const parsed = parseWorkflowFile(example);
    const serialized = serializeWorkflowFile(parsed);
    const reparsed = parseWorkflowFile(serialized);

    expect(reparsed).toEqual(parsed);
  });

  test("minimal workflow maintains consistency", () => {
    const parsed = parseWorkflowFile(minimalExample);
    const serialized = serializeWorkflowFile(parsed);
    const reparsed = parseWorkflowFile(serialized);

    expect(reparsed).toEqual(parsed);
  });
});

describe("edge cases", () => {
  test("handles Windows line endings", () => {
    const windowsExample = example.replace(/\n/g, "\r\n");
    const result = parseWorkflowFile(windowsExample);

    expect(result.name).toBe("Example Agent / Workflow");
    expect(result.prompt).toBe("This is the prompt");
  });

  test("handles mixed line endings", () => {
    const mixedExample = `---\r\nname: Mixed\n---\r\nPrompt content\n`;
    const result = parseWorkflowFile(mixedExample);

    expect(result.name).toBe("Mixed");
    expect(result.prompt).toBe("Prompt content");
  });

  test("handles empty name string", () => {
    const emptyNameExample = `
---
name: ""
---
Prompt
`.trim();

    expect(() => parseWorkflowFile(emptyNameExample)).toThrow(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  });

  test("handles null name", () => {
    const nullNameExample = `
---
name: null
---
Prompt
`.trim();

    expect(() => parseWorkflowFile(nullNameExample)).toThrow(
      "Workflow file must contain YAML frontmatter with a 'name' field",
    );
  });
});
