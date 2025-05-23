import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearLastEmptyResponse } from './clearLastEmptyResponse';

// Mock dependencies first - because vi.mock is hoisted
vi.mock('./cancelToolCallAndAddResult', () => ({
  cancelToolCallAndAddResult: vi.fn().mockReturnValue({ type: 'mocked-cancel-tool-call' }),
}));

vi.mock('../slices/sessionSlice', () => ({
  removeLastHistoryItem: vi.fn().mockReturnValue({ type: 'remove-last-history-item' }),
  removeHistoryItemById: vi.fn().mockReturnValue({ type: 'remove-history-item-by-id' }),
}));

// Import mocks after they are defined
import { removeHistoryItemById, removeLastHistoryItem } from '../slices/sessionSlice';
import { cancelToolCallAndAddResult } from './cancelToolCallAndAddResult';

describe('clearLastEmptyResponse thunk', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create a mock dispatch function that returns its argument (for chaining)
    mockDispatch = vi.fn().mockImplementation(action => action);
  });

  test('should do nothing if history has fewer than 2 items', async () => {
    // Arrange
    const getState = () => ({
      session: {
        history: [{ message: { id: '1', role: 'user', content: 'Hello' }, contextItems: [] }]
      }
    });

    // Act
    const result = await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert - We only expect the thunk's own dispatches, not any internal actions
    expect(removeLastHistoryItem).not.toHaveBeenCalled();
    expect(cancelToolCallAndAddResult).not.toHaveBeenCalled();
  });

  test('should remove last item if it is an empty assistant message', async () => {
    // Arrange
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Hello' }, contextItems: [] },
          { message: { id: '2', role: 'assistant', content: '' }, contextItems: [] }
        ]
      }
    });

    // Act
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert
    expect(removeLastHistoryItem).toHaveBeenCalled();
  });

  test('should remove last item if it is a thinking message', async () => {
    // Arrange
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Hello' }, contextItems: [] },
          { message: { id: '2', role: 'thinking', content: 'Thinking...' }, contextItems: [] }
        ]
      }
    });

    // Act
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert
    expect(removeLastHistoryItem).toHaveBeenCalled();
  });

  test('should add tool result for tool call without result', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use a tool' }, contextItems: [] },
          { 
            message: { 
              id: '2', 
              role: 'assistant', 
              content: 'Using tool...',
              toolCalls: [{ id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId,
              status: 'generating',
              toolCall: { id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          // No tool result for this tool call
          { message: { id: '3', role: 'user', content: 'Another message' }, contextItems: [] }
        ]
      }
    });

    // Act - Execute the thunk directly
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert - Check that our cancel tool call function was called with the right ID
    expect(cancelToolCallAndAddResult).toHaveBeenCalledWith(toolCallId);
  });

  test('should not add tool result if one already exists', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use a tool' }, contextItems: [] },
          { 
            message: { 
              id: '2', 
              role: 'assistant', 
              content: 'Using tool...',
              toolCalls: [{ id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId,
              status: 'generating',
              toolCall: { id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          { 
            message: { 
              id: '3', 
              role: 'tool', 
              content: 'Tool result',
              toolCallId
            },
            contextItems: []
          }
        ]
      }
    });

    // Act - Execute the thunk directly
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert - cancelToolCallAndAddResult shouldn't be called with this ID
    expect(cancelToolCallAndAddResult).not.toHaveBeenCalledWith(toolCallId);
  });

  test('should remove orphaned tool results', async () => {
    // Arrange
    const orphanedToolCallId = 'tool-orphaned';
    const messageId = 'message-3';
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use a tool' }, contextItems: [] },
          { message: { id: '2', role: 'assistant', content: 'Response without tool call' }, contextItems: [] },
          { 
            message: { 
              id: messageId, 
              role: 'tool', 
              content: 'Orphaned tool result', 
              toolCallId: orphanedToolCallId 
            },
            contextItems: []
          }
        ]
      }
    });

    // Act - Execute the thunk directly
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert
    expect(removeHistoryItemById).toHaveBeenCalledWith(messageId);
  });

  test('should not remove tool results that have corresponding tool calls', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    const messageId = 'message-3';
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use a tool' }, contextItems: [] },
          { 
            message: { 
              id: '2', 
              role: 'assistant', 
              content: 'Using tool...',
              toolCalls: [{ id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId,
              status: 'generating',
              toolCall: { id: toolCallId, type: 'function', function: { name: 'testTool', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          { 
            message: { 
              id: messageId, 
              role: 'tool', 
              content: 'Valid tool result',
              toolCallId
            },
            contextItems: []
          }
        ]
      }
    });

    // Act - Execute the thunk directly
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert - make sure we didn't call removeHistoryItemById with this ID
    expect(removeHistoryItemById).not.toHaveBeenCalledWith(messageId);
  });

  test('should handle multiple tool calls and results appropriately', async () => {
    // Arrange
    const toolCallId1 = 'tool-123';
    const toolCallId2 = 'tool-456';
    const orphanedToolCallId = 'tool-orphaned';
    const messageId = '5';
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use multiple tools' }, contextItems: [] },
          { 
            message: { 
              id: '2', 
              role: 'assistant', 
              content: 'Using tools...',
              toolCalls: [{ id: toolCallId1, type: 'function', function: { name: 'testTool1', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId: toolCallId1,
              status: 'generating',
              toolCall: { id: toolCallId1, type: 'function', function: { name: 'testTool1', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          { 
            message: { 
              id: '3', 
              role: 'tool', 
              content: 'Tool 1 result', 
              toolCallId: toolCallId1 
            },
            contextItems: []
          },
          { 
            message: { 
              id: '4', 
              role: 'assistant', 
              content: 'Using another tool...',
              toolCalls: [{ id: toolCallId2, type: 'function', function: { name: 'testTool2', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId: toolCallId2,
              status: 'generating',
              toolCall: { id: toolCallId2, type: 'function', function: { name: 'testTool2', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          // No result for toolCallId2
          { 
            message: { 
              id: messageId, 
              role: 'tool', 
              content: 'Orphaned tool result', 
              toolCallId: orphanedToolCallId 
            },
            contextItems: []
          }
        ]
      }
    });

    // Act - Execute the thunk directly
    await clearLastEmptyResponse()(mockDispatch, getState, undefined);

    // Assert - verify expected behavior directly on the mocks
    // Should add result for tool call without result
    expect(cancelToolCallAndAddResult).toHaveBeenCalledWith(toolCallId2);
    
    // Should remove orphaned tool result
    expect(removeHistoryItemById).toHaveBeenCalledWith(messageId);
    
    // Should not add result for tool call that already has one
    expect(cancelToolCallAndAddResult).not.toHaveBeenCalledWith(toolCallId1);
  });
});
