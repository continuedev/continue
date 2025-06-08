import { parseMarkdownRule } from "../../config/markdown/parseMarkdownRule";
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

  it("should create a rule with glob pattern", async () => {
    const args = {
      name: "TypeScript Rule",
      rule: "Use interfaces for object shapes",
      globs: "**/*.{ts,tsx}",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    const fileContent = mockIde.writeFile.mock.calls[0][1];

    const { frontmatter, markdown } = parseMarkdownRule(fileContent);

    expect(frontmatter).toEqual({
      globs: "**/*.{ts,tsx}",
    });

    expect(markdown).toContain("# TypeScript Rule");
    expect(markdown).toContain("Use interfaces for object shapes");
  });

  it("should create a filename based on sanitized rule name", async () => {
    const args = {
      name: "Special Ch@racters & Spaces",
      rule: "Handle special characters",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    const fileUri = mockIde.writeFile.mock.calls[0][0];
    expect(fileUri).toContain("special-chracters-spaces.md");
  });

  it("should create a rule with description pattern", async () => {
    const args = {
      name: "Description Test",
      rule: "This is the rule content",
      description: "This is a detailed explanation of the rule",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    const fileContent = mockIde.writeFile.mock.calls[0][1];

    const { frontmatter, markdown } = parseMarkdownRule(fileContent);

    expect(frontmatter).toEqual({
      description: "This is a detailed explanation of the rule",
    });

    expect(markdown).toContain("# Description Test");
    expect(markdown).toContain("This is the rule content");
  });

  it("should include both globs and description in frontmatter", async () => {
    const args = {
      name: "Complete Rule",
      rule: "Follow this standard",
      description: "This rule enforces our team standards",
      globs: "**/*.js",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    const fileContent = mockIde.writeFile.mock.calls[0][1];

    const { frontmatter, markdown } = parseMarkdownRule(fileContent);

    expect(frontmatter).toEqual({
      description: "This rule enforces our team standards",
      globs: "**/*.js",
    });

    expect(markdown).toContain("# Complete Rule");
    expect(markdown).toContain("Follow this standard");
  });

  it("should create a rule with alwaysApply set to false", async () => {
    const args = {
      name: "Conditional Rule",
      rule: "This rule should not always be applied",
      alwaysApply: false,
    };

    await createRuleBlockImpl(args, mockExtras as any);

    const fileContent = mockIde.writeFile.mock.calls[0][1];

    const { frontmatter } = parseMarkdownRule(fileContent);

    expect(frontmatter).toEqual({
      alwaysApply: false,
    });
  });
});
