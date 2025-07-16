import { getToolDisplayName, getToolsDescription, extractToolCalls } from './index.js';

describe('tools/index utilities', () => {
  describe('getToolDisplayName', () => {
    it('should return display name for known tool', () => {
      // The actual implementation returns the first part of the displayName
      const result = getToolDisplayName('read_file');
      expect(result).toBe('Read');
    });

    it('should return original name for unknown tool', () => {
      const result = getToolDisplayName('unknown_tool');
      expect(result).toBe('unknown_tool');
    });

    it('should handle empty string', () => {
      const result = getToolDisplayName('');
      expect(result).toBe('');
    });
  });

  describe('getToolsDescription', () => {
    it('should return formatted JSON description of tools', () => {
      const result = getToolsDescription();
      expect(result).toContain('"name": "read_file"');
      expect(result).toContain('"description": "Read the contents of a file at the specified path"');
      expect(result).toContain('"type": "string"');
      expect(result).toContain('"required": true');
      expect(result).toContain('"required": [');
    });

    it('should include parameters for tools', () => {
      const result = getToolsDescription();
      expect(result).toContain('"filepath"');
      expect(result).toContain('"content"');
      expect(result).toContain('"dirpath"');
    });

    it('should format as valid JSON structure', () => {
      const result = getToolsDescription();
      // Check that it contains JSON-like structure
      expect(result).toMatch(/\{\s*"name":/);
      expect(result).toMatch(/"parameters":\s*\{/);
      expect(result).toMatch(/"properties":\s*\{/);
    });
  });

  describe('extractToolCalls', () => {
    it('should extract single tool call', () => {
      const response = `Here's the result:
<tool>{"name": "read_file", "arguments": {"filepath": "/path/to/file.txt"}}</tool>
Done.`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'read_file',
          arguments: { filepath: '/path/to/file.txt' }
        }
      ]);
    });

    it('should extract multiple tool calls', () => {
      const response = `First call:
<tool>{"name": "read_file", "arguments": {"filepath": "/file1.txt"}}</tool>
Second call:
<tool>{"name": "write_file", "arguments": {"filepath": "/file2.txt", "content": "hello"}}</tool>
Done.`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'read_file',
          arguments: { filepath: '/file1.txt' }
        },
        {
          name: 'write_file',
          arguments: { filepath: '/file2.txt', content: 'hello' }
        }
      ]);
    });

    it('should handle tool calls with complex arguments', () => {
      const response = `<tool>{"name": "search_code", "arguments": {"pattern": "function.*test", "path": "/src", "options": {"recursive": true, "ignoreCase": false}}}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'search_code',
          arguments: { 
            pattern: 'function.*test', 
            path: '/src', 
            options: { recursive: true, ignoreCase: false } 
          }
        }
      ]);
    });

    it('should handle multiline tool calls', () => {
      const response = `<tool>{
  "name": "write_file",
  "arguments": {
    "filepath": "/path/to/file.txt",
    "content": "Line 1\\nLine 2\\nLine 3"
  }
}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'write_file',
          arguments: { 
            filepath: '/path/to/file.txt', 
            content: 'Line 1\nLine 2\nLine 3' 
          }
        }
      ]);
    });

    it('should return empty array when no tool calls found', () => {
      const response = `This is just regular text with no tool calls.`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([]);
    });

    it('should handle empty response', () => {
      const response = '';
      
      const result = extractToolCalls(response);
      expect(result).toEqual([]);
    });

    it('should ignore malformed tool calls', () => {
      // Capture console.error to avoid polluting test output
      const originalConsoleError = console.error;
      console.error = () => {};
      
      const response = `Good call:
<tool>{"name": "read_file", "arguments": {"filepath": "/file.txt"}}</tool>
Bad call:
<tool>{"name": "invalid_json", "arguments": {malformed json}}</tool>
Another good call:
<tool>{"name": "write_file", "arguments": {"filepath": "/file2.txt", "content": "test"}}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'read_file',
          arguments: { filepath: '/file.txt' }
        },
        {
          name: 'write_file',
          arguments: { filepath: '/file2.txt', content: 'test' }
        }
      ]);
      
      // Restore console.error
      console.error = originalConsoleError;
    });

    it('should ignore tool calls missing required fields', () => {
      const response = `Missing name:
<tool>{"arguments": {"filepath": "/file.txt"}}</tool>
Missing arguments:
<tool>{"name": "read_file"}</tool>
Valid call:
<tool>{"name": "read_file", "arguments": {"filepath": "/file.txt"}}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'read_file',
          arguments: { filepath: '/file.txt' }
        }
      ]);
    });

    it('should handle tool calls with empty arguments', () => {
      const response = `<tool>{"name": "list_files", "arguments": {}}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'list_files',
          arguments: {}
        }
      ]);
    });

    it('should handle tool calls with null arguments', () => {
      const response = `<tool>{"name": "exit", "arguments": null}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([]);
    });

    it('should handle nested tool tags', () => {
      const response = `<tool>{"name": "write_file", "arguments": {"filepath": "/file.txt", "content": "Some content with <tool> tags inside"}}</tool>`;
      
      const result = extractToolCalls(response);
      expect(result).toEqual([
        {
          name: 'write_file',
          arguments: { 
            filepath: '/file.txt', 
            content: 'Some content with <tool> tags inside' 
          }
        }
      ]);
    });
  });
});