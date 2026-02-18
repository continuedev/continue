import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ContextItemId,
  ContextItemWithId,
  RuleWithSource,
  UserChatMessage,
} from "../..";

import { getApplicableRules } from "../../llm/rules/getSystemMessageWithRules";

describe("Rule Colocation Application", () => {
  // Create a set of rules in different directories
  const rules: RuleWithSource[] = [
    // Root level rule - should apply everywhere
    {
      name: "Root Rule",
      rule: "Follow project standards",
      source: "colocated-markdown",
      sourceFile: ".continue/rules.md",
    },

    // Nested directory rule without globs - should only apply to files in that directory
    {
      name: "React Components Rule",
      rule: "Use functional components with hooks",
      source: "colocated-markdown",
      sourceFile: "src/components/rules.md",
      // No explicit globs - should implicitly only apply to files in that directory
    },

    // Nested directory rule with explicit globs - should apply to matching files only
    {
      name: "Redux Rule",
      rule: "Use Redux Toolkit for state management",
      globs: "src/redux/**/*.{ts,tsx}",
      source: "colocated-markdown",
      sourceFile: "src/redux/rules.md",
    },

    // Directory rule with specific file extension glob
    {
      name: "TypeScript Components Rule",
      rule: "Use TypeScript with React components",
      globs: "**/*.tsx", // Only apply to .tsx files
      source: "colocated-markdown",
      sourceFile: "src/components/rules.md",
    },

    // Rule for a specific subdirectory with its own glob
    {
      name: "API Utils Rule",
      rule: "Follow API utility conventions",
      globs: "**/*.ts", // Only TypeScript files in this directory
      source: "colocated-markdown",
      sourceFile: "src/utils/api/rules.md",
    },
  ];

  // Mock user message and context for various scenarios
  let userMessageWithComponentFile: UserChatMessage;
  let userMessageWithReduxFile: UserChatMessage;
  let userMessageWithRootFile: UserChatMessage;
  let userMessageWithApiUtilFile: UserChatMessage;
  let userMessageWithComponentJsxFile: UserChatMessage;

  let componentTsxContextItem: ContextItemWithId;
  let componentJsxContextItem: ContextItemWithId;
  let reduxContextItem: ContextItemWithId;
  let rootContextItem: ContextItemWithId;
  let apiUtilContextItem: ContextItemWithId;
  let otherUtilContextItem: ContextItemWithId;

  beforeEach(() => {
    // Setup user messages with different code blocks
    userMessageWithComponentFile = {
      role: "user",
      content:
        "Can you help me with this component file?\n```tsx src/components/Button.tsx\nexport const Button = () => {...}\n```",
    };

    userMessageWithComponentJsxFile = {
      role: "user",
      content:
        "Can you help me with this JSX component file?\n```jsx src/components/OldButton.jsx\nexport const OldButton = () => {...}\n```",
    };

    userMessageWithReduxFile = {
      role: "user",
      content:
        'Can you help with this redux slice?\n```ts src/redux/userSlice.ts\nimport { createSlice } from "@reduxjs/toolkit";\n```',
    };

    userMessageWithRootFile = {
      role: "user",
      content:
        "Can you help with this utility file?\n```ts src/utils/helpers.ts\nexport const formatDate = (date) => {...}\n```",
    };

    userMessageWithApiUtilFile = {
      role: "user",
      content:
        "Can you help with this API utility file?\n```ts src/utils/api/requests.ts\nexport const fetchData = () => {...}\n```",
    };

    // Setup context items
    componentTsxContextItem = {
      id: { providerTitle: "file", itemId: "context1" } as ContextItemId,
      uri: { type: "file", value: "src/components/Button.tsx" },
      content: "export const Button = () => {...}",
      name: "Button.tsx",
      description: "Component file",
    };

    componentJsxContextItem = {
      id: { providerTitle: "file", itemId: "context1b" } as ContextItemId,
      uri: { type: "file", value: "src/components/OldButton.jsx" },
      content: "export const OldButton = () => {...}",
      name: "OldButton.jsx",
      description: "Component file",
    };

    reduxContextItem = {
      id: { providerTitle: "file", itemId: "context2" } as ContextItemId,
      uri: { type: "file", value: "src/redux/userSlice.ts" },
      content: 'import { createSlice } from "@reduxjs/toolkit";',
      name: "userSlice.ts",
      description: "Redux slice",
    };

    rootContextItem = {
      id: { providerTitle: "file", itemId: "context3" } as ContextItemId,
      uri: { type: "file", value: "src/utils/helpers.ts" },
      content: "export const formatDate = (date) => {...}",
      name: "helpers.ts",
      description: "Utility file",
    };

    apiUtilContextItem = {
      id: { providerTitle: "file", itemId: "context4" } as ContextItemId,
      uri: { type: "file", value: "src/utils/api/requests.ts" },
      content: "export const fetchData = () => {...}",
      name: "requests.ts",
      description: "API utility file",
    };

    otherUtilContextItem = {
      id: { providerTitle: "file", itemId: "context5" } as ContextItemId,
      uri: { type: "file", value: "src/utils/format.ts" },
      content: "export const formatCurrency = (amount) => {...}",
      name: "format.ts",
      description: "Formatting utility",
    };
  });

  describe("Basic directory-specific rule application", () => {
    it("should apply root rules to all files", () => {
      // Test with component file
      let applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        rules,
        [componentTsxContextItem],
      );
      expect(applicableRules.map((r) => r.name)).toContain("Root Rule");

      // Test with redux file
      applicableRules = getApplicableRules(userMessageWithReduxFile, rules, [
        reduxContextItem,
      ]);
      expect(applicableRules.map((r) => r.name)).toContain("Root Rule");

      // Test with root-level file
      applicableRules = getApplicableRules(userMessageWithRootFile, rules, [
        rootContextItem,
      ]);
      expect(applicableRules.map((r) => r.name)).toContain("Root Rule");
    });
  });

  describe("Directory-specific rule application with implied globs", () => {
    it("should only apply component rules to files in the component directory when no globs specified", () => {
      // Create a rule without explicit globs but with a file path in the components directory
      const impliedComponentRule: RuleWithSource = {
        name: "Implied Components Rule",
        rule: "Use React component best practices",
        source: "colocated-markdown",
        sourceFile: "src/components/rules.md",
        // No explicit globs - should infer from directory
      };

      // Test with component file - should apply the rule
      let applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        [impliedComponentRule],
        [componentTsxContextItem],
      );
      expect(applicableRules.map((r) => r.name)).toContain(
        "Implied Components Rule",
      );

      // Test with redux file - should NOT apply the component rule
      // This is failing currently - we need to fix the implementation
      applicableRules = getApplicableRules(
        userMessageWithReduxFile,
        [impliedComponentRule],
        [reduxContextItem],
      );

      // THIS WILL FAIL - Current implementation doesn't restrict by directory
      expect(applicableRules.map((r) => r.name)).not.toContain(
        "Implied Components Rule",
      );

      // Test with root-level file - should NOT apply the component rule
      // This is failing currently - we need to fix the implementation
      applicableRules = getApplicableRules(
        userMessageWithRootFile,
        [impliedComponentRule],
        [rootContextItem],
      );

      // THIS WILL FAIL - Current implementation doesn't restrict by directory
      expect(applicableRules.map((r) => r.name)).not.toContain(
        "Implied Components Rule",
      );
    });
  });

  describe("Combined directory and glob pattern matching", () => {
    it("should respect directory + glob pattern when both are present", () => {
      // Create a rule with explicit glob in a nested directory
      const typescriptComponentRule: RuleWithSource = {
        name: "TypeScript Component Rule",
        rule: "Use TypeScript with React components",
        globs: "**/*.tsx", // Only apply to .tsx files
        source: "colocated-markdown",
        sourceFile: "src/components/rules.md",
      };

      // Test with TSX component file - should apply
      let applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        [typescriptComponentRule],
        [componentTsxContextItem],
      );
      expect(applicableRules.map((r) => r.name)).toContain(
        "TypeScript Component Rule",
      );

      // Test with JSX component file - should NOT apply (wrong extension)
      // This test is likely to pass even with current implementation since the glob is explicit
      applicableRules = getApplicableRules(
        userMessageWithComponentJsxFile,
        [typescriptComponentRule],
        [componentJsxContextItem],
      );
      expect(applicableRules.map((r) => r.name)).not.toContain(
        "TypeScript Component Rule",
      );

      // Test with TS file outside components directory - should NOT apply
      // This test will fail because current implementation doesn't consider directory boundaries
      applicableRules = getApplicableRules(
        userMessageWithReduxFile,
        [typescriptComponentRule],
        [reduxContextItem],
      );

      // THIS WILL FAIL - Current impl only checks file extension, not directory
      expect(applicableRules.map((r) => r.name)).not.toContain(
        "TypeScript Component Rule",
      );
    });
  });

  describe("Nested directory rules with globs", () => {
    it("should apply API utils rule only to files in that directory matching the glob", () => {
      // Create a rule for a specific subdirectory with its own glob
      const apiUtilsRule: RuleWithSource = {
        name: "API Utils Rule",
        rule: "Follow API utility conventions",
        globs: "**/*.ts", // Only TypeScript files in this directory
        source: "colocated-markdown",
        sourceFile: "src/utils/api/rules.md",
      };

      // Test with file in the API utils directory - should apply
      let applicableRules = getApplicableRules(
        userMessageWithApiUtilFile,
        [apiUtilsRule],
        [apiUtilContextItem],
      );
      expect(applicableRules.map((r) => r.name)).toContain("API Utils Rule");

      // Test with TS file in general utils directory - should NOT apply
      // This test will fail because current implementation doesn't consider directory boundaries
      applicableRules = getApplicableRules(
        userMessageWithRootFile,
        [apiUtilsRule],
        [rootContextItem],
      );

      // THIS WILL FAIL - Current impl only checks file extension, not directory
      expect(applicableRules.map((r) => r.name)).not.toContain(
        "API Utils Rule",
      );
    });
  });

  describe("Rule application inference strategy", () => {
    it("should infer directory-specific glob patterns from rule file location", () => {
      // This test will propose the expected behavior for the feature:
      // When a rules.md file is colocated in a directory without explicit globs,
      // it should automatically create an implicit glob pattern for that directory.

      function createRuleWithAutomaticGlobInference(
        sourceFilePath: string,
      ): RuleWithSource {
        const directory = path.dirname(sourceFilePath);
        // The expected behavior would be to create an implicit glob like this:
        const expectedGlob = `${directory}/**/*`;

        return {
          name: `Inferred Rule for ${directory}`,
          rule: `Follow standards for ${directory}`,
          source: "colocated-markdown",
          sourceFile: sourceFilePath,
          // In a fixed implementation, these globs would be automatically inferred
          // globs: expectedGlob,
        };
      }

      // Create rules for different directories
      const modelsRule = createRuleWithAutomaticGlobInference(
        "src/models/rules.md",
      );
      const servicesRule = createRuleWithAutomaticGlobInference(
        "src/services/rules.md",
      );

      // Create context items for different files
      const modelFileContext: ContextItemWithId = {
        id: { providerTitle: "file", itemId: "models1" } as ContextItemId,
        uri: { type: "file", value: "src/models/user.ts" },
        content: "export interface User {...}",
        name: "user.ts",
        description: "User model",
      };

      const serviceFileContext: ContextItemWithId = {
        id: { providerTitle: "file", itemId: "services1" } as ContextItemId,
        uri: { type: "file", value: "src/services/auth.ts" },
        content: "export const login = () => {...}",
        name: "auth.ts",
        description: "Auth service",
      };

      // Test with model file - should apply only the models rule
      const applicableModelsRules = getApplicableRules(
        undefined, // No user message needed
        [modelsRule, servicesRule],
        [modelFileContext],
      );

      // These assertions will fail with current implementation
      // but represent the desired behavior
      expect(applicableModelsRules.map((r) => r.name)).toContain(
        "Inferred Rule for src/models",
      );
      expect(applicableModelsRules.map((r) => r.name)).not.toContain(
        "Inferred Rule for src/services",
      );

      // Test with service file - should apply only the services rule
      const applicableServicesRules = getApplicableRules(
        undefined, // No user message needed
        [modelsRule, servicesRule],
        [serviceFileContext],
      );

      // These assertions will fail with current implementation
      // but represent the desired behavior
      expect(applicableServicesRules.map((r) => r.name)).not.toContain(
        "Inferred Rule for src/models",
      );
      expect(applicableServicesRules.map((r) => r.name)).toContain(
        "Inferred Rule for src/services",
      );
    });
  });
});
