import { describe, expect, it } from "vitest";
import {
  ContextItemId,
  ContextItemWithId,
  RuleWithSource,
  UserChatMessage,
} from "../..";
import { getApplicableRules } from "./getSystemMessageWithRules";

describe("Nested directory rules application", () => {
  // The rule in nested-folder/rules.md (without globs)
  const nestedFolderRule: RuleWithSource = {
    name: "Nested Folder Rule",
    rule: "HELLO WORLD THIS IS A RULE",
    source: "rules-block",
    sourceFile: "manual-testing-sandbox/nested-folder/rules.md",
    // No globs specified
  };

  // A global rule for comparison
  const globalRule: RuleWithSource = {
    name: "Global Rule",
    rule: "SOLID Design Principles - Coding Agent Guidelines",
    source: "rules-block",
    sourceFile: ".continue/rules.md",
  };

  it("should apply nested directory rules to files in that directory", () => {
    // Create a context with a file in the nested directory
    const nestedFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "nested1" } as ContextItemId,
      uri: {
        type: "file",
        value: "manual-testing-sandbox/nested-folder/hellonested.py",
      },
      content: 'print("Hello nested")',
      name: "hellonested.py",
      description: "Nested file",
    };

    // Apply rules with the nested file context
    const applicableRules = getApplicableRules(
      undefined, // No message needed
      [nestedFolderRule, globalRule],
      [nestedFileContext],
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain("Global Rule");
    expect(applicableRules.map((r) => r.name)).toContain("Nested Folder Rule");
  });

  it("should also work with file references in messages", () => {
    // Message with a file reference in the nested directory
    const messageWithNestedFile: UserChatMessage = {
      role: "user",
      content:
        'Can you explain this file?\n```python manual-testing-sandbox/nested-folder/hellonested.py\nprint("Hello nested")\n```',
    };

    // Apply rules with the message containing a nested file reference
    const applicableRules = getApplicableRules(
      messageWithNestedFile,
      [nestedFolderRule, globalRule],
      [],
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain("Global Rule");
    expect(applicableRules.map((r) => r.name)).toContain("Nested Folder Rule");
  });

  it("should NOT apply nested directory rules to files outside that directory", () => {
    // Context with a file outside the nested directory
    const outsideFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "outside1" } as ContextItemId,
      uri: { type: "file", value: "src/utils/helper.ts" },
      content: "export const helper = () => {...}",
      name: "helper.ts",
      description: "Helper file",
    };

    // Apply rules with file context outside nested directory
    const applicableRules = getApplicableRules(
      undefined,
      [nestedFolderRule, globalRule],
      [outsideFileContext],
    );

    // Only the global rule should be included
    expect(applicableRules.map((r) => r.name)).toContain("Global Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Nested Folder Rule",
    );
  });

  it("should apply glob patterns relative to rules.md location", () => {
    // A rule in src/ that targets *.py files
    const srcPythonRule: RuleWithSource = {
      name: "Src Python Rule",
      rule: "Follow Python best practices for src directory",
      globs: "**/*.py", // This should only match .py files in src/ and subdirectories
      source: "rules-block",
      sourceFile: "src/rules.md",
    };

    // A rule in utils/ that targets *.py files
    const utilsPythonRule: RuleWithSource = {
      name: "Utils Python Rule",
      rule: "Follow Python best practices for utils directory",
      globs: "**/*.py", // This should only match .py files in utils/ and subdirectories
      source: "rules-block",
      sourceFile: "utils/rules.md",
    };

    // A file in src/
    const srcPythonFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "python1" } as ContextItemId,
      uri: { type: "file", value: "src/pythonfile.py" },
      content: 'print("Hello")',
      name: "pythonfile.py",
      description: "Python file in src",
    };

    // A file in utils/
    const utilsPythonFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "python2" } as ContextItemId,
      uri: { type: "file", value: "utils/pythonfile.py" },
      content: 'print("Hello")',
      name: "pythonfile.py",
      description: "Python file in utils",
    };

    // A file in manual-testing-sandbox/
    const manualTestingPythonFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "python3" } as ContextItemId,
      uri: { type: "file", value: "manual-testing-sandbox/pythonfile.py" },
      content: 'print("Hello")',
      name: "pythonfile.py",
      description: "Python file in manual-testing-sandbox",
    };

    // Apply src rule to src file - should match
    let applicableRules = getApplicableRules(
      undefined,
      [srcPythonRule, utilsPythonRule],
      [srcPythonFileContext],
    );
    expect(applicableRules.map((r) => r.name)).toContain("Src Python Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Utils Python Rule",
    );

    // Apply utils rule to utils file - should match
    applicableRules = getApplicableRules(
      undefined,
      [srcPythonRule, utilsPythonRule],
      [utilsPythonFileContext],
    );
    expect(applicableRules.map((r) => r.name)).not.toContain("Src Python Rule");
    expect(applicableRules.map((r) => r.name)).toContain("Utils Python Rule");

    // Apply both rules to manual-testing-sandbox file - should not match either
    applicableRules = getApplicableRules(
      undefined,
      [srcPythonRule, utilsPythonRule],
      [manualTestingPythonFileContext],
    );
    expect(applicableRules.map((r) => r.name)).not.toContain("Src Python Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Utils Python Rule",
    );
  });
});
