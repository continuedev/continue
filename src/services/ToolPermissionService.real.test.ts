import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolPermissionService } from './ToolPermissionService.js';
import { checkToolPermission } from '../permissions/permissionChecker.js';

describe('ToolPermissionService - Real Tool Permission Test', () => {
  let service: ToolPermissionService;

  beforeEach(() => {
    service = new ToolPermissionService();
  });

  describe('Plan Mode Real Tool Tests', () => {
    beforeEach(() => {
      service.initializeSync({ mode: 'plan' });
    });

    it('should deny write_file tool in plan mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'write_file',
        arguments: { path: 'test.txt', content: 'test' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`write_file permission check result:`, result);
      expect(result.permission).toBe('exclude');
    });

    it('should deny search_and_replace_in_file tool in plan mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'search_and_replace_in_file',
        arguments: { path: 'test.txt', old_str: 'old', new_str: 'new' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`search_and_replace_in_file permission check result:`, result);
      expect(result.permission).toBe('exclude');
    });

    it('should deny run_terminal_command tool in plan mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'run_terminal_command',
        arguments: { command: 'ls' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`run_terminal_command permission check result:`, result);
      expect(result.permission).toBe('exclude');
    });

    it('should allow read_file tool in plan mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'read_file',
        arguments: { path: 'test.txt' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`read_file permission check result:`, result);
      expect(result.permission).toBe('allow');
    });

    it('should allow list_files tool in plan mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'list_files',
        arguments: { path: '.' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`list_files permission check result:`, result);
      expect(result.permission).toBe('allow');
    });

    it('should deny unknown tools in plan mode (wildcard exclude)', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'unknown_write_tool',
        arguments: {}
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`unknown_write_tool permission check result:`, result);
      expect(result.permission).toBe('exclude');
    });
  });

  describe('Auto Mode Real Tool Tests', () => {
    beforeEach(() => {
      service.initializeSync({ mode: 'auto' });
    });

    it('should allow write_file tool in auto mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'write_file',
        arguments: { path: 'test.txt', content: 'test' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`Auto mode write_file permission check result:`, result);
      expect(result.permission).toBe('allow');
    });

    it('should allow run_terminal_command tool in auto mode', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'run_terminal_command',
        arguments: { command: 'ls' }
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`Auto mode run_terminal_command permission check result:`, result);
      expect(result.permission).toBe('allow');
    });

    it('should allow unknown tools in auto mode (wildcard allow)', () => {
      const permissions = service.getPermissions();
      const toolCall = {
        name: 'unknown_tool',
        arguments: {}
      };
      const result = checkToolPermission(toolCall, permissions);
      
      console.log(`Auto mode unknown_tool permission check result:`, result);
      expect(result.permission).toBe('allow');
    });
  });

  describe('Mode Override Test', () => {
    it('should override user permissions when switching to plan mode', () => {
      // Start with user explicitly allowing write_file
      service.initializeSync({
        allow: ['write_file'],
        mode: 'normal'
      });

      // Verify write_file is allowed in normal mode
      let permissions = service.getPermissions();
      const toolCall = {
        name: 'write_file',
        arguments: { path: 'test.txt', content: 'test' }
      };
      let result = checkToolPermission(toolCall, permissions);
      console.log(`Normal mode with user allow - write_file result:`, result);
      expect(result.permission).toBe('allow');

      // Switch to plan mode - should OVERRIDE user config completely
      service.switchMode('plan');
      permissions = service.getPermissions();
      result = checkToolPermission(toolCall, permissions);
      
      console.log(`After switching to plan mode - write_file result:`, result);
      console.log(`Plan mode policies:`, permissions.policies.map(p => `${p.tool}:${p.permission}`));
      expect(result.permission).toBe('exclude');
    });
  });
});