import { describe, it, expect, beforeEach, vi } from 'vitest';

import { checkToolPermission } from './permissionChecker.js';
import { yamlConfigToPolicies } from './permissionsYamlLoader.js';

// Mock fs module
vi.mock('fs');

describe('YAML Permissions - Edit Tool Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow Edit tool when it is in the allow list', () => {
    // Test the exact YAML content from the user
    const yamlContent = `allow:
  - Edit
ask: []
exclude: []`;

    // Parse the YAML config
    const config = {
      allow: ['Edit'],
      ask: [],
      exclude: []
    };

    // Convert to policies
    const policies = yamlConfigToPolicies(config);
    console.log('Converted policies:', policies);

    // The policies should have Edit as allowed
    expect(policies).toEqual([
      { tool: 'Edit', permission: 'allow' }
    ]);

    // Test permission check with tool call named "Edit"
    const toolCall1 = {
      name: 'Edit',
      arguments: { filepath: 'test.txt' }
    };
    const result1 = checkToolPermission(toolCall1, { policies });
    console.log('Permission check for "Edit":', result1);
    expect(result1.permission).toBe('allow');

    // Legacy names should NOT work anymore
    const toolCall2 = {
      name: 'search_and_replace_in_file',
      arguments: { filepath: 'test.txt' }
    };
    const result2 = checkToolPermission(toolCall2, { policies });
    console.log('Permission check for "search_and_replace_in_file":', result2);
    expect(result2.permission).toBe('ask'); // Should not match, falls back to ask

    // Legacy names should NOT work anymore
    const toolCall3 = {
      name: 'edit_file',
      arguments: { filepath: 'test.txt' }
    };
    const result3 = checkToolPermission(toolCall3, { policies });
    console.log('Permission check for "edit_file":', result3);
    expect(result3.permission).toBe('ask'); // Should not match, falls back to ask
  });

  it('should check what normalizeToolName returns for Edit variations', async () => {
    const { normalizeToolName } = await import('./toolNameMapping.js');
    
    console.log('normalizeToolName("Edit"):', normalizeToolName("Edit"));
    console.log('normalizeToolName("edit"):', normalizeToolName("edit"));
    console.log('normalizeToolName("edit_file"):', normalizeToolName("edit_file"));
    console.log('normalizeToolName("search_and_replace_in_file"):', normalizeToolName("search_and_replace_in_file"));
    
    // Only proper names and case variations should normalize
    expect(normalizeToolName("Edit")).toBe("Edit");
    expect(normalizeToolName("edit")).toBe("Edit");
    
    // Legacy snake_case names should not normalize anymore
    expect(normalizeToolName("edit_file")).toBe("edit_file");
    expect(normalizeToolName("search_and_replace_in_file")).toBe("search_and_replace_in_file");
  });
});