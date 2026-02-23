import { parseMarkdownRule } from "@continuedev/config-yaml";
import { jest } from "@jest/globals";
import { createRuleBlockImpl } from "./createRuleBlock";

const mockIde = {
  getWorkspaceDirs: jest.fn<() => Promise<string[]>>().mockResolvedValue(["/"]),
  writeFile: jest
    .fn<(path: string, content: string) => Promise<void>>()
    .mockResolvedValue(undefined),
  openFile: jest
    .fn<(path: string) => Promise<void>>()
    .mockResolvedValue(undefined),
};

const mockExtras = {
  ide: mockIde,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("createRuleBlockImpl should create a rule with glob pattern", async () => {
  const args = {
    name: "TypeScript Rule",
    rule: "Use interfaces for object shapes",
    description: "Always use interfaces",
    alwaysApply: true,
    globs: "**/*.{ts,tsx}",
  };

  await createRuleBlockImpl(args, mockExtras as any);

  const fileContent = mockIde.writeFile.mock.calls[0][1] as string;

  const { frontmatter, markdown } = parseMarkdownRule(fileContent);

  expect(frontmatter).toEqual({
    alwaysApply: true,
    description: "Always use interfaces",
    globs: "**/*.{ts,tsx}",
  });

  expect(markdown).toContain("Use interfaces for object shapes");
});

test("createRuleBlockImpl should create a filename based on sanitized rule name using shared path function", async () => {
  const args = {
    name: "Special Ch@racters & Spaces",
    rule: "Handle special characters",
    description: "Test rule",
    alwaysApply: false,
  };

  await createRuleBlockImpl(args, mockExtras as any);

  const fileUri = mockIde.writeFile.mock.calls[0][0];
  expect(fileUri).toBe("/.continue/rules/special-chracters-spaces.md");
});

test("createRuleBlockImpl should create a rule with description pattern", async () => {
  const args = {
    name: "Description Test",
    rule: "This is the rule content",
    description: "This is a detailed explanation of the rule",
    alwaysApply: true,
  };

  await createRuleBlockImpl(args, mockExtras as any);

  const fileContent = mockIde.writeFile.mock.calls[0][1] as string;

  const { frontmatter, markdown } = parseMarkdownRule(fileContent);

  expect(frontmatter).toEqual({
    alwaysApply: true,
    description: "This is a detailed explanation of the rule",
  });

  expect(markdown).toContain("This is the rule content");
});

test("createRuleBlockImpl should include both globs and description in frontmatter", async () => {
  const args = {
    name: "Complete Rule",
    rule: "Follow this standard",
    description: "This rule enforces our team standards",
    alwaysApply: false,
    globs: "**/*.js",
  };

  await createRuleBlockImpl(args, mockExtras as any);

  const fileContent = mockIde.writeFile.mock.calls[0][1] as string;

  const { frontmatter, markdown } = parseMarkdownRule(fileContent);

  expect(frontmatter).toEqual({
    alwaysApply: false,
    description: "This rule enforces our team standards",
    globs: "**/*.js",
  });

  expect(markdown).toContain("Follow this standard");
});

test("createRuleBlockImpl should create a rule with alwaysApply set to false", async () => {
  const args = {
    name: "Conditional Rule",
    rule: "This rule should not always be applied",
    description: "Optional rule",
    alwaysApply: false,
  };

  await createRuleBlockImpl(args, mockExtras as any);

  const fileContent = mockIde.writeFile.mock.calls[0][1] as string;

  const { frontmatter } = parseMarkdownRule(fileContent);

  expect(frontmatter).toEqual({
    alwaysApply: false,
    description: "Optional rule",
  });
});
