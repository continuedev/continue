import * as YAML from "yaml";
import { createRuleBlockImpl } from "./createRuleBlock";

// Mock the extras parameter with necessary functions
const mockIde = {
  getWorkspaceDirs: jest.fn().mockResolvedValue(["/"]),
  writeFile: jest.fn().mockResolvedValue(undefined),
  openFile: jest.fn().mockResolvedValue(undefined),
};

const mockExtras = {
  ide: mockIde,
};

describe("createRuleBlockImpl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a basic rule with name and rule content", async () => {
    const args = {
      name: "Test Rule",
      rule: "Always write tests",
    };

    const result = await createRuleBlockImpl(args, mockExtras as any);

    // Verify that writeFile was called
    expect(mockIde.writeFile).toHaveBeenCalled();

    // Verify the file name
    const fileUri = mockIde.writeFile.mock.calls[0][0];
    expect(fileUri).toContain("test-rule.md");

    // Get the content
    const fileContent = mockIde.writeFile.mock.calls[0][1];

    // Verify the content structure
    expect(fileContent).toContain("---");
    expect(fileContent).toContain("# Test Rule");
    expect(fileContent).toContain("Always write tests");

    // Should have empty frontmatter - it will be "{}" not "" due to how YAML.stringify works with empty objects
    const parts = fileContent.split(/^---\s*$/m);
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const frontmatterStr = parts[1].trim();
    expect(frontmatterStr === "" || frontmatterStr === "{}").toBeTruthy();
  });

  it("should create a rule with glob pattern", async () => {
    const args = {
      name: "TypeScript Rule",
      rule: "Use interfaces for object shapes",
      globs: "**/*.{ts,tsx}",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Get the content
    const fileContent = mockIde.writeFile.mock.calls[0][1];

    // Parse the frontmatter
    const parts = fileContent.split(/^---\s*$/m);
    const frontmatterStr = parts[1].trim();
    const frontmatter = YAML.parse(frontmatterStr);

    // Verify the frontmatter contains globs
    expect(frontmatter).toEqual({
      globs: "**/*.{ts,tsx}",
    });

    // Verify the content has the rule
    expect(fileContent).toContain("# TypeScript Rule");
    expect(fileContent).toContain("Use interfaces for object shapes");
  });

  it("should create a filename based on sanitized rule name", async () => {
    const args = {
      name: "Special Ch@racters & Spaces",
      rule: "Handle special characters",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Check that the filename is sanitized
    const fileUri = mockIde.writeFile.mock.calls[0][0];
    expect(fileUri).toContain("special-chracters-spaces.md");
  });

  it("should include description in frontmatter and content", async () => {
    const args = {
      name: "Description Test",
      rule: "This is the rule content",
      description: "This is a detailed explanation of the rule",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Get the content
    const fileContent = mockIde.writeFile.mock.calls[0][1];

    // Parse the frontmatter
    const parts = fileContent.split(/^---\s*$/m);
    const frontmatterStr = parts[1].trim();
    const frontmatter = YAML.parse(frontmatterStr);

    // Verify the frontmatter contains description
    expect(frontmatter).toEqual({
      description: "This is a detailed explanation of the rule",
    });

    // Verify the content structure includes description before rule
    expect(fileContent).toContain("# Description Test");
    expect(fileContent).toContain("This is a detailed explanation of the rule");
    expect(fileContent).toContain("This is the rule content");
  });

  it("should include both globs and description in frontmatter", async () => {
    const args = {
      name: "Complete Rule",
      rule: "Follow this standard",
      description: "This rule enforces our team standards",
      globs: "**/*.js",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Get the content
    const fileContent = mockIde.writeFile.mock.calls[0][1];

    // Parse the frontmatter
    const parts = fileContent.split(/^---\s*$/m);
    const frontmatterStr = parts[1].trim();
    const frontmatter = YAML.parse(frontmatterStr);

    // Verify the frontmatter contains both description and globs
    expect(frontmatter).toEqual({
      description: "This rule enforces our team standards",
      globs: "**/*.js",
    });
  });
});
