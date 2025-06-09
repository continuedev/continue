import { describe, expect, it } from 'vitest';
import { ContextItemWithId, RuleWithSource, UserChatMessage } from '../..';
import { getApplicableRules } from './getSystemMessageWithRules';

describe('Rule application with alwaysApply', () => {
  // Create an always-apply rule
  const alwaysApplyRule: RuleWithSource = {
    name: 'Always Apply Rule',
    rule: 'This rule should always be applied',
    alwaysApply: true,
    source: 'rules-block',
    ruleFile: '.continue/always-apply.md',
  };
  
  // Create a colocated rule in a nested directory
  const nestedDirRule: RuleWithSource = {
    name: 'Nested Directory Rule',
    rule: 'This rule applies to files in the nested directory',
    source: 'rules-block',
    ruleFile: 'nested-folder/rules.md',
  };

  it('should apply alwaysApply rules even with no file references', () => {
    // Message with no code blocks or file references
    const simpleMessage: UserChatMessage = {
      id: '1',
      role: 'user',
      content: 'Can you help me understand how this works?',
      createdAt: new Date().toISOString(),
    };

    // Apply rules with no context items
    const applicableRules = getApplicableRules(
      simpleMessage, 
      [alwaysApplyRule, nestedDirRule],
      []
    );

    // The always apply rule should be included regardless of context
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
    expect(applicableRules.map(r => r.name)).not.toContain('Nested Directory Rule');
  });

  it('should apply nested directory rules to files in that directory', () => {
    // Context with a file in the nested directory
    const nestedFileContext: ContextItemWithId = {
      id: 'context1',
      uri: { type: 'file', value: 'nested-folder/example.ts' },
      content: 'export const example = () => {...}',
      retrievedAt: new Date().toISOString(),
    };

    // Apply rules with file context in nested directory
    const applicableRules = getApplicableRules(
      undefined, // No message needed
      [alwaysApplyRule, nestedDirRule],
      [nestedFileContext]
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
    expect(applicableRules.map(r => r.name)).toContain('Nested Directory Rule');
  });

  it('should NOT apply nested directory rules to files outside that directory', () => {
    // Context with a file outside the nested directory
    const outsideFileContext: ContextItemWithId = {
      id: 'context2',
      uri: { type: 'file', value: 'src/utils/helper.ts' },
      content: 'export const helper = () => {...}',
      retrievedAt: new Date().toISOString(),
    };

    // Apply rules with file context outside nested directory
    const applicableRules = getApplicableRules(
      undefined, // No message needed
      [alwaysApplyRule, nestedDirRule],
      [outsideFileContext]
    );

    // Only the always apply rule should be included
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
    expect(applicableRules.map(r => r.name)).not.toContain('Nested Directory Rule');
  });

  it('should correctly apply rules when a file is mentioned in a message', () => {
    // Message with a file reference
    const messageWithFile: UserChatMessage = {
      id: '3',
      role: 'user',
      content: 'Can you help with this file?\n```ts nested-folder/example.ts\nexport const example = () => {...}\n```',
      createdAt: new Date().toISOString(),
    };

    // Apply rules with a message containing a file reference
    const applicableRules = getApplicableRules(
      messageWithFile,
      [alwaysApplyRule, nestedDirRule],
      []
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
    expect(applicableRules.map(r => r.name)).toContain('Nested Directory Rule');
  });

  it('should always apply rules with alwaysApply regardless of message or context', () => {
    // Test with no message or context
    let applicableRules = getApplicableRules(
      undefined,
      [alwaysApplyRule],
      []
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
    
    // Test with message but no file references and no context
    const simpleMessage: UserChatMessage = {
      id: '4',
      role: 'user',
      content: 'Hello, can you help me?',
      createdAt: new Date().toISOString(),
    };
    
    applicableRules = getApplicableRules(
      simpleMessage,
      [alwaysApplyRule],
      []
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map(r => r.name)).toContain('Always Apply Rule');
  });
});