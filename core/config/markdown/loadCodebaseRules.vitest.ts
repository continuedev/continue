import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCodebaseRules } from './loadCodebaseRules';
import { walkDirs } from '../../indexing/walkDir';
import { IDE } from '../..';
import { convertMarkdownRuleToContinueRule } from './parseMarkdownRule';

// Mock dependencies
vi.mock('../../indexing/walkDir', () => ({
  walkDirs: vi.fn(),
}));

vi.mock('./parseMarkdownRule', () => ({
  convertMarkdownRuleToContinueRule: vi.fn(),
}));

describe('loadCodebaseRules', () => {
  // Mock IDE
  const mockIde = {
    readFile: vi.fn(),
  } as unknown as IDE;

  // Setup test files
  const mockFiles = [
    'src/rules.md',
    'src/redux/rules.md',
    'src/components/rules.md',
    'src/utils/helper.ts', // Non-rules file
    '.continue/rules.md', // This should also be loaded
  ];

  // Mock rule content
  const mockRuleContent = {
    'src/rules.md': '# General Rules\nFollow coding standards',
    'src/redux/rules.md': '---\nglobs: "**/*.{ts,tsx}"\n---\n# Redux Rules\nUse Redux Toolkit',
    'src/components/rules.md': '---\nglobs: ["**/*.tsx", "**/*.jsx"]\n---\n# Component Rules\nUse functional components',
    '.continue/rules.md': '# Global Rules\nFollow project guidelines',
  };

  // Mock converted rules
  const mockConvertedRules = {
    'src/rules.md': {
      name: 'General Rules',
      rule: 'Follow coding standards',
      source: 'rules-block',
      ruleFile: 'src/rules.md',
    },
    'src/redux/rules.md': {
      name: 'Redux Rules',
      rule: 'Use Redux Toolkit',
      globs: '**/*.{ts,tsx}',
      source: 'rules-block',
      ruleFile: 'src/redux/rules.md',
    },
    'src/components/rules.md': {
      name: 'Component Rules',
      rule: 'Use functional components',
      globs: ['**/*.tsx', '**/*.jsx'],
      source: 'rules-block',
      ruleFile: 'src/components/rules.md',
    },
    '.continue/rules.md': {
      name: 'Global Rules',
      rule: 'Follow project guidelines',
      source: 'rules-block',
      ruleFile: '.continue/rules.md',
    },
  };

  beforeEach(() => {
    // Setup mocks
    vi.resetAllMocks();
    
    // Mock walkDirs to return our test files
    (walkDirs as any).mockResolvedValue(mockFiles);
    
    // Mock readFile to return content based on path
    mockIde.readFile.mockImplementation((path: string) => {
      return Promise.resolve(mockRuleContent[path] || '');
    });
    
    // Mock convertMarkdownRuleToContinueRule to return converted rules
    (convertMarkdownRuleToContinueRule as any).mockImplementation((path: string, content: string) => {
      return mockConvertedRules[path];
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should load rules from all rules.md files in the workspace', async () => {
    const { rules, errors } = await loadCodebaseRules(mockIde);
    
    // Should find all rules.md files
    expect(walkDirs).toHaveBeenCalledWith(mockIde);
    
    // Should read all rules.md files
    expect(mockIde.readFile).toHaveBeenCalledTimes(4);
    expect(mockIde.readFile).toHaveBeenCalledWith('src/rules.md');
    expect(mockIde.readFile).toHaveBeenCalledWith('src/redux/rules.md');
    expect(mockIde.readFile).toHaveBeenCalledWith('src/components/rules.md');
    expect(mockIde.readFile).toHaveBeenCalledWith('.continue/rules.md');
    
    // Should convert all rules
    expect(convertMarkdownRuleToContinueRule).toHaveBeenCalledTimes(4);
    
    // Should return all rules
    expect(rules).toHaveLength(4);
    expect(rules).toContainEqual(mockConvertedRules['src/rules.md']);
    expect(rules).toContainEqual(mockConvertedRules['src/redux/rules.md']);
    expect(rules).toContainEqual(mockConvertedRules['src/components/rules.md']);
    expect(rules).toContainEqual(mockConvertedRules['.continue/rules.md']);
    
    // Should not have errors
    expect(errors).toHaveLength(0);
  });

  it('should handle errors when reading a rule file', async () => {
    // Setup mock to throw for a specific file
    mockIde.readFile.mockImplementation((path: string) => {
      if (path === 'src/redux/rules.md') {
        return Promise.reject(new Error('Failed to read file'));
      }
      return Promise.resolve(mockRuleContent[path] || '');
    });
    
    const { rules, errors } = await loadCodebaseRules(mockIde);
    
    // Should still return other rules
    expect(rules).toHaveLength(3);
    expect(rules).toContainEqual(mockConvertedRules['src/rules.md']);
    expect(rules).toContainEqual(mockConvertedRules['src/components/rules.md']);
    expect(rules).toContainEqual(mockConvertedRules['.continue/rules.md']);
    
    // Should have one error
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Failed to parse colocated rule file src/redux/rules.md');
  });

  it('should handle errors when walkDirs fails', async () => {
    // Setup mock to throw
    (walkDirs as any).mockRejectedValue(new Error('Failed to walk directories'));
    
    const { rules, errors } = await loadCodebaseRules(mockIde);
    
    // Should return no rules
    expect(rules).toHaveLength(0);
    
    // Should have one error
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Error loading colocated rule files');
  });
});