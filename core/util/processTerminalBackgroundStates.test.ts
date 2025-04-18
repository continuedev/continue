import {
  markProcessAsBackgrounded,
  isProcessBackgrounded,
  removeBackgroundedProcess
} from './processTerminalBackgroundStates';

describe('processTerminalBackgroundStates', () => {
  beforeEach(() => {
    // Clear any backgrounded processes before each test
    const backgroundedProcesses = Array.from(
      Object.getOwnPropertySymbols(global)
    ).find(symbol => String(symbol) === 'Symbol(processTerminalBackgroundStates)');
    
    if (backgroundedProcesses) {
      // Reset the map by reimporting the module
      jest.resetModules();
    }
  });

  test('should mark a process as backgrounded', () => {
    const toolCallId = 'test-123';
    markProcessAsBackgrounded(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(true);
  });

  test('should correctly identify non-backgrounded processes', () => {
    const toolCallId = 'test-123';
    const anotherToolCallId = 'test-456';
    
    markProcessAsBackgrounded(toolCallId);
    
    expect(isProcessBackgrounded(toolCallId)).toBe(true);
    expect(isProcessBackgrounded(anotherToolCallId)).toBe(false);
  });

  test('should remove a process from backgrounded state', () => {
    const toolCallId = 'test-123';
    
    markProcessAsBackgrounded(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(true);
    
    removeBackgroundedProcess(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(false);
  });

  test('should handle removing non-existent processes', () => {
    const toolCallId = 'test-123';
    
    // Should not throw an error
    removeBackgroundedProcess(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(false);
  });

  test('should handle multiple processes', () => {
    const toolCallId1 = 'test-123';
    const toolCallId2 = 'test-456';
    const toolCallId3 = 'test-789';
    
    markProcessAsBackgrounded(toolCallId1);
    markProcessAsBackgrounded(toolCallId2);
    
    expect(isProcessBackgrounded(toolCallId1)).toBe(true);
    expect(isProcessBackgrounded(toolCallId2)).toBe(true);
    expect(isProcessBackgrounded(toolCallId3)).toBe(false);
    
    removeBackgroundedProcess(toolCallId1);
    
    expect(isProcessBackgrounded(toolCallId1)).toBe(false);
    expect(isProcessBackgrounded(toolCallId2)).toBe(true);
  });
});