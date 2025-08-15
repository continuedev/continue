import { describe, test, expect } from 'vitest';

import { initializeServices, getServiceSync, SERVICE_NAMES, MCPServiceState } from './services/index.js'
import type { ToolPermissionServiceState } from './services/ToolPermissionService.js';
import { getAllTools } from './streamChatResponse.js';

vi.mock('../configLoader.js', () => ({
  loadConfiguration: vi.fn().mockResolvedValue({
    config: { 
      name: 'test-config',
      models: [],
      mcpServers: []
    },
    source: { type: 'default-agent' }
  })
}));

describe('getAllTools - Tool Filtering', () => {
  test('should exclude Bash tool in plan mode after service initialization', async () => {
    // Initialize services in plan mode (simulating `cn -p`)
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: 'plan'
      }
    });

    // Verify service is ready
    const mcpServiceResult = getServiceSync<MCPServiceState>(SERVICE_NAMES.MCP);
    expect(mcpServiceResult.state).toBe('ready');
    const serviceResult = getServiceSync<ToolPermissionServiceState>(SERVICE_NAMES.TOOL_PERMISSIONS);
    expect(serviceResult.state).toBe('ready');
    expect(serviceResult.value?.currentMode).toBe('plan');

    // Get available tools - this should exclude Bash in plan mode
    const tools = await getAllTools();
    const toolNames = tools.map(t => t.function.name);

    // Bash should be excluded in plan mode
    expect(toolNames).not.toContain('Bash');
    
    // Read-only tools should still be available
    expect(toolNames).toContain('Read');
    expect(toolNames).toContain('List');
    expect(toolNames).toContain('Search');
    expect(toolNames).toContain('Fetch');
    expect(toolNames).toContain('Checklist');
    
    // Write tools should be excluded
    expect(toolNames).not.toContain('Write');
    expect(toolNames).not.toContain('Edit');
  });

  test('should include Bash tool in normal mode', async () => {
    // Initialize services in normal mode
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: 'normal'
      }
    });

    // Verify service is ready
    const serviceResult = getServiceSync<ToolPermissionServiceState>(SERVICE_NAMES.TOOL_PERMISSIONS);
    expect(serviceResult.state).toBe('ready');
    expect(serviceResult.value?.currentMode).toBe('normal');

    // Get available tools - Bash should be available in normal mode
    const tools = await getAllTools();
    const toolNames = tools.map(t => t.function.name);

    // All tools should be available in normal mode
    expect(toolNames).toContain('Bash');
    expect(toolNames).toContain('Read');
    expect(toolNames).toContain('Write');
    expect(toolNames).toContain('Edit');
  });

  test('should include all tools in auto mode', async () => {
    // Initialize services in auto mode
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: 'auto'
      }
    });

    // Verify service is ready
    const serviceResult = getServiceSync<ToolPermissionServiceState>(SERVICE_NAMES.TOOL_PERMISSIONS);
    expect(serviceResult.state).toBe('ready');
    expect(serviceResult.value?.currentMode).toBe('auto');

    // Get available tools - all tools should be available in auto mode
    const tools = await getAllTools();
    const toolNames = tools.map(t => t.function.name);

    // All tools should be available in auto mode
    expect(toolNames).toContain('Bash');
    expect(toolNames).toContain('Read');
    expect(toolNames).toContain('Write');
    expect(toolNames).toContain('Edit');
  });

  test('should respect explicit exclude in normal mode', async () => {
    // Initialize services in normal mode with Read tool explicitly excluded
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: 'normal',
        exclude: ['Read']
      }
    });

    const tools = await getAllTools();
    const toolNames = tools.map(t => t.function.name);

    // Read should be excluded due to explicit exclude
    expect(toolNames).not.toContain('Read');
    
    // Other tools should still be available in normal mode
    expect(toolNames).toContain('Bash');
    expect(toolNames).toContain('Write');
    expect(toolNames).toContain('List');
    expect(toolNames).toContain('Search');
  });

  test('plan mode should override allow flags (regression test for GitHub Actions issue)', async () => {
    // This test specifically addresses the original issue where plan mode
    // wasn't properly excluding tools despite being in plan mode
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: 'plan',
        allow: ['Write', 'Bash'] // These should be ignored in plan mode
      }
    });

    const tools = await getAllTools();
    const toolNames = tools.map(t => t.function.name);

    // Plan mode should still exclude write tools despite --allow flags
    // This tests that plan mode policies have absolute precedence
    expect(toolNames).not.toContain('Write');
    expect(toolNames).not.toContain('Bash');
    expect(toolNames).not.toContain('Edit');
    
    // Read-only tools should be available
    expect(toolNames).toContain('Read');
    expect(toolNames).toContain('List');
    expect(toolNames).toContain('Search');
  });
});