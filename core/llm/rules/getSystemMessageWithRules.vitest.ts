import { describe, expect, it } from 'vitest';
import { RuleWithSource } from '../..';
import { shouldApplyRule, getApplicableRules } from './getSystemMessageWithRules';

describe('Fix for rule colocation glob matching', () => {
  // This test file demonstrates the expected behavior after our fix

  it('should restrict rules by their directory when no globs specified', () => {
    // Rule in a nested directory with no globs - should only apply to files in that directory
    const componentRule: RuleWithSource = {
      name: 'Components Rule',
      rule: 'Use functional components with hooks',
      source: 'rules-block',
      ruleFile: 'src/components/rules.md',
      // No explicit globs - should only apply to files in src/components/ directory
    };
    
    // Files in the same directory - should match
    const matchingFiles = ['src/components/Button.tsx', 'src/components/Form.jsx'];
    expect(shouldApplyRule(componentRule, matchingFiles)).toBe(true);
    
    // Files outside the directory - should NOT match
    const nonMatchingFiles = ['src/utils/helpers.ts', 'src/redux/slice.ts'];
    expect(shouldApplyRule(componentRule, nonMatchingFiles)).toBe(false);
  });

  it('should combine directory restriction with explicit globs', () => {
    // Rule with explicit globs in a nested directory
    const tsxComponentRule: RuleWithSource = {
      name: 'TSX Components Rule',
      rule: 'Use TypeScript with React components',
      globs: '**/*.tsx', // Only .tsx files
      source: 'rules-block',
      ruleFile: 'src/components/rules.md',
      // Should only apply to .tsx files in src/components/ directory
    };
    
    // TSX files in the same directory - should match
    const matchingFiles = ['src/components/Button.tsx', 'src/components/Form.tsx'];
    expect(shouldApplyRule(tsxComponentRule, matchingFiles)).toBe(true);
    
    // Non-TSX files in the same directory - should NOT match
    const nonMatchingExtension = ['src/components/OldButton.jsx'];
    expect(shouldApplyRule(tsxComponentRule, nonMatchingExtension)).toBe(false);
    
    // TSX files outside the directory - should NOT match
    const nonMatchingDir = ['src/pages/Home.tsx', 'src/App.tsx'];
    expect(shouldApplyRule(tsxComponentRule, nonMatchingDir)).toBe(false);
  });
  
  it('should apply root-level rules to all files', () => {
    // Rule at the root level
    const rootRule: RuleWithSource = {
      name: 'Root Rule',
      rule: 'Follow project standards',
      source: 'rules-block',
      ruleFile: '.continue/rules.md',
      // No restriction, should apply to all files
    };
    
    // Files in various directories - should all match
    const files = [
      'src/components/Button.tsx', 
      'src/redux/slice.ts',
      'src/utils/helpers.ts'
    ];
    expect(shouldApplyRule(rootRule, files)).toBe(true);
  });
  
  it('should respect alwaysApply override regardless of directory', () => {
    // Rule with alwaysApply: true
    const alwaysApplyRule: RuleWithSource = {
      name: 'Always Apply Rule',
      rule: 'Follow these guidelines always',
      alwaysApply: true,
      source: 'rules-block',
      ruleFile: 'src/specific/rules.md',
      // Should apply to all files regardless of directory
    };
    
    // Files in various directories - should all match due to alwaysApply: true
    const files = [
      'src/components/Button.tsx', 
      'src/redux/slice.ts',
      'src/utils/helpers.ts'
    ];
    expect(shouldApplyRule(alwaysApplyRule, files)).toBe(true);
    
    // Rule with alwaysApply: false and no globs
    const neverApplyRule: RuleWithSource = {
      name: 'Never Apply Rule',
      rule: 'This rule should never apply',
      alwaysApply: false,
      source: 'rules-block',
      ruleFile: 'src/specific/rules.md',
      // Should never apply since alwaysApply is false and there are no globs
    };
    
    expect(shouldApplyRule(neverApplyRule, files)).toBe(false);
  });
  
  it('should support complex directory + glob combinations', () => {
    // Rule with complex glob pattern in a nested directory
    const testExclusionRule: RuleWithSource = {
      name: 'Test Exclusion Rule',
      rule: 'Apply to TS files but not test files',
      globs: ['**/*.ts', '!**/*.test.ts', '!**/*.spec.ts'],
      source: 'rules-block',
      ruleFile: 'src/utils/rules.md',
      // Should only apply to non-test TS files in src/utils/
    };
    
    // Regular TS file in utils - should match
    expect(shouldApplyRule(testExclusionRule, ['src/utils/helpers.ts'])).toBe(true);
    
    // Test TS file in utils - should NOT match due to negative glob
    expect(shouldApplyRule(testExclusionRule, ['src/utils/helpers.test.ts'])).toBe(false);
    
    // Regular TS file outside utils - should NOT match due to directory restriction
    expect(shouldApplyRule(testExclusionRule, ['src/models/user.ts'])).toBe(false);
  });
});