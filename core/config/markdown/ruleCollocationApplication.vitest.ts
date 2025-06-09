import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RuleWithSource, ContextItemWithId, UserChatMessage } from '../..';
import { getApplicableRules } from '../../llm/rules/getSystemMessageWithRules';

describe('Rule Colocation Application', () => {
  // Create a set of rules in different directories
  const rules: RuleWithSource[] = [
    // Root level rule
    {
      name: 'Root Rule',
      rule: 'Follow project standards',
      source: 'rules-block',
      ruleFile: '.continue/rules.md',
    },
    // Nested directory rule - should only apply to files within that directory
    {
      name: 'React Components Rule',
      rule: 'Use functional components with hooks',
      source: 'rules-block',
      ruleFile: 'src/components/rules.md',
      // No explicit globs - should implicitly only apply to files in that directory
    },
    // Another nested directory rule with explicit globs
    {
      name: 'Redux Rule',
      rule: 'Use Redux Toolkit for state management',
      globs: 'src/redux/**/*.{ts,tsx}',
      source: 'rules-block',
      ruleFile: 'src/redux/rules.md',
    }
  ];

  // Mock user message and context for various scenarios
  let userMessageWithComponentFile: UserChatMessage;
  let userMessageWithReduxFile: UserChatMessage;
  let userMessageWithRootFile: UserChatMessage;
  
  let componentContextItem: ContextItemWithId;
  let reduxContextItem: ContextItemWithId;
  let rootContextItem: ContextItemWithId;

  beforeEach(() => {
    // Setup user messages with different code blocks
    userMessageWithComponentFile = {
      id: '1',
      role: 'user',
      content: 'Can you help me with this component file?\n```tsx src/components/Button.tsx\nexport const Button = () => {...}\n```',
      createdAt: new Date().toISOString(),
    };

    userMessageWithReduxFile = {
      id: '2',
      role: 'user',
      content: 'Can you help with this redux slice?\n```ts src/redux/userSlice.ts\nimport { createSlice } from "@reduxjs/toolkit";\n```',
      createdAt: new Date().toISOString(),
    };

    userMessageWithRootFile = {
      id: '3',
      role: 'user',
      content: 'Can you help with this utility file?\n```ts src/utils/helpers.ts\nexport const formatDate = (date) => {...}\n```',
      createdAt: new Date().toISOString(),
    };

    // Setup context items
    componentContextItem = {
      id: 'context1',
      uri: { type: 'file', value: 'src/components/Button.tsx' },
      content: 'export const Button = () => {...}',
      retrievedAt: new Date().toISOString(),
    };

    reduxContextItem = {
      id: 'context2',
      uri: { type: 'file', value: 'src/redux/userSlice.ts' },
      content: 'import { createSlice } from "@reduxjs/toolkit";',
      retrievedAt: new Date().toISOString(),
    };

    rootContextItem = {
      id: 'context3',
      uri: { type: 'file', value: 'src/utils/helpers.ts' },
      content: 'export const formatDate = (date) => {...}',
      retrievedAt: new Date().toISOString(),
    };
  });

  describe('Directory-specific rule application', () => {
    it('should apply root rules to all files', () => {
      // Test with component file
      let applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        rules,
        [componentContextItem]
      );
      expect(applicableRules.map(r => r.name)).toContain('Root Rule');

      // Test with redux file
      applicableRules = getApplicableRules(
        userMessageWithReduxFile,
        rules,
        [reduxContextItem]
      );
      expect(applicableRules.map(r => r.name)).toContain('Root Rule');

      // Test with root-level file
      applicableRules = getApplicableRules(
        userMessageWithRootFile, 
        rules,
        [rootContextItem]
      );
      expect(applicableRules.map(r => r.name)).toContain('Root Rule');
    });

    it('should only apply component rules to component files', () => {
      // Test with component file - should apply the rule
      let applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        rules,
        [componentContextItem]
      );
      expect(applicableRules.map(r => r.name)).toContain('React Components Rule');

      // Test with redux file - should NOT apply the component rule
      applicableRules = getApplicableRules(
        userMessageWithReduxFile,
        rules,
        [reduxContextItem]
      );
      
      // THIS WILL FAIL - Current implementation doesn't restrict by directory
      expect(applicableRules.map(r => r.name)).not.toContain('React Components Rule');

      // Test with root-level file - should NOT apply the component rule
      applicableRules = getApplicableRules(
        userMessageWithRootFile,
        rules,
        [rootContextItem]
      );
      
      // THIS WILL FAIL - Current implementation doesn't restrict by directory
      expect(applicableRules.map(r => r.name)).not.toContain('React Components Rule');
    });

    it('should only apply redux rules to redux files', () => {
      // Test with redux file - should apply the rule
      let applicableRules = getApplicableRules(
        userMessageWithReduxFile,
        rules,
        [reduxContextItem]
      );
      expect(applicableRules.map(r => r.name)).toContain('Redux Rule');

      // Test with component file - should NOT apply the redux rule
      applicableRules = getApplicableRules(
        userMessageWithComponentFile,
        rules,
        [componentContextItem]
      );
      expect(applicableRules.map(r => r.name)).not.toContain('Redux Rule');

      // Test with root-level file - should NOT apply the redux rule
      applicableRules = getApplicableRules(
        userMessageWithRootFile,
        rules,
        [rootContextItem]
      );
      expect(applicableRules.map(r => r.name)).not.toContain('Redux Rule');
    });

    it('should automatically infer glob patterns from rule file location if none specified', () => {
      // This test demonstrates the expected behavior we want:
      // When a rule.md file is placed in a directory without specifying globs,
      // it should automatically be applied only to files in that directory and subdirectories
      
      // Create a rule without explicit globs but with a file path in a nested directory
      const inferredGlobRule: RuleWithSource = {
        name: 'Models Rule',
        rule: 'Follow data model conventions',
        source: 'rules-block',
        ruleFile: 'src/models/rules.md',
        // No explicit globs - should infer from directory
      };

      // Create context with a file in the models directory
      const modelFileContext: ContextItemWithId = {
        id: 'context4',
        uri: { type: 'file', value: 'src/models/user.ts' },
        content: 'export interface User {...}',
        retrievedAt: new Date().toISOString(),
      };

      // Create context with a file outside the models directory
      const nonModelFileContext: ContextItemWithId = {
        id: 'context5',
        uri: { type: 'file', value: 'src/utils/api.ts' },
        content: 'export const fetchData = () => {...}',
        retrievedAt: new Date().toISOString(),
      };

      // Test with model file - should apply the rule
      let applicableRules = getApplicableRules(
        undefined, // No user message needed
        [inferredGlobRule],
        [modelFileContext]
      );
      
      // THIS WILL PASS with current implementation but shouldn't
      expect(applicableRules.map(r => r.name)).toContain('Models Rule');

      // Test with non-model file - should NOT apply the rule
      applicableRules = getApplicableRules(
        undefined, // No user message needed
        [inferredGlobRule],
        [nonModelFileContext]
      );
      
      // THIS WILL FAIL - Current implementation doesn't infer globs from directory
      expect(applicableRules.map(r => r.name)).not.toContain('Models Rule');
    });
  });
});