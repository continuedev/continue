import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { findToolCall } from '../util';
import { cancelToolCallAndAddResult } from './cancelToolCallAndAddResult';

// Mock dependencies
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

vi.mock('../util', () => ({
  findToolCall: vi.fn(),
}));

describe('cancelToolCallAndAddResult thunk', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  const mockUUID = 'mock-uuid-12345';

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Set up UUID mock to return a consistent value
    (uuidv4 as any).mockReturnValue(mockUUID);
    
    // Create a mock dispatch function
    mockDispatch = vi.fn();
  });

  test('should cancel tool call and add tool result message', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    
    // Mock the findToolCall utility to return a tool call state object
    (findToolCall as any).mockReturnValue({
      toolCallId,
      status: 'generating',
      toolCall: { 
        id: toolCallId, 
        type: 'function', 
        function: { name: 'testTool', arguments: '{}' } 
      },
      parsedArgs: {}
    });
    
    // Create a mock state with a tool call but no tool result
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
          }
        ]
      }
    });

    // Act
    const result = await cancelToolCallAndAddResult(toolCallId)(mockDispatch, getState, undefined);

    // Assert
    // Verify the thunk returned the expected payload
    expect(result.payload).toEqual({
      toolCallId,
      toolResultMessage: {
        message: {
          id: mockUUID,
          role: 'tool',
          content: 'Tool use was cancelled.',
          toolCallId
        },
        contextItems: []
      }
    });
    
    // Verify findToolCall was called with the correct arguments
    expect(findToolCall).toHaveBeenCalledWith(
      getState().session.history,
      toolCallId
    );

    // Verify UUID was generated for the new message
    expect(uuidv4).toHaveBeenCalled();
  });

  test('should not create a message when no tool call is found', async () => {
    // Arrange
    const toolCallId = 'non-existent-tool-call';
    
    // Mock findToolCall to return null (no tool call found)
    (findToolCall as any).mockReturnValue(null);
    
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Hello' }, contextItems: [] },
          { message: { id: '2', role: 'assistant', content: 'Hello there' }, contextItems: [] }
        ]
      }
    });

    // We expect a console warning when no tool call is found, so let's spy on console.warn
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    const result = await cancelToolCallAndAddResult(toolCallId)(mockDispatch, getState, undefined);

    // Assert
    // Verify no payload was returned
    expect(result.payload).toBeUndefined();
    
    // Verify that a warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(`No tool call found with ID: ${toolCallId}`);
  });

  test('should not create a message when a tool result already exists', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    
    // Mock findToolCall to return a tool call
    (findToolCall as any).mockReturnValue({
      toolCallId,
      status: 'generating',
      toolCall: { 
        id: toolCallId, 
        type: 'function', 
        function: { name: 'testTool', arguments: '{}' } 
      },
      parsedArgs: {}
    });
    
    // Create mock state with a tool call AND a tool result
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
              content: 'Tool result already exists', 
              toolCallId 
            },
            contextItems: []
          }
        ]
      }
    });

    // We expect a console log when a tool result already exists
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const result = await cancelToolCallAndAddResult(toolCallId)(mockDispatch, getState, undefined);

    // Assert
    // Verify no payload was returned
    expect(result.payload).toBeUndefined();
    
    // Verify that a log message was recorded
    expect(consoleLogSpy).toHaveBeenCalledWith(`Tool result already exists for tool call ${toolCallId}`);
  });

  test('should create a correctly structured tool result message', async () => {
    // Arrange
    const toolCallId = 'tool-123';
    
    (findToolCall as any).mockReturnValue({
      toolCallId,
      status: 'generating',
      toolCall: { 
        id: toolCallId, 
        type: 'function', 
        function: { name: 'testTool', arguments: '{}' } 
      },
      parsedArgs: {}
    });
    
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
          }
        ]
      }
    });

    // Act
    const result = await cancelToolCallAndAddResult(toolCallId)(mockDispatch, getState, undefined);

    // Assert
    // Check the structure of the tool result message
    // Using a type assertion to let TypeScript know the expected payload structure
    const toolResultMessage = result.payload ? 
      (result.payload as { toolCallId: string; toolResultMessage: any }).toolResultMessage 
      : undefined;
    
    expect(toolResultMessage).toEqual({
      message: {
        id: mockUUID,
        role: 'tool',
        content: 'Tool use was cancelled.',
        toolCallId
      },
      contextItems: []
    });
    
    // Verify the message has the expected properties
    expect(toolResultMessage?.message.role).toBe('tool');
    expect(toolResultMessage?.message.content).toBe('Tool use was cancelled.');
    expect(toolResultMessage?.message.toolCallId).toBe(toolCallId);
    expect(toolResultMessage?.message.id).toBe(mockUUID);
    expect(toolResultMessage?.contextItems).toEqual([]);
  });

  test('should work with multiple tool calls in history', async () => {
    // Arrange
    const toolCallId1 = 'tool-123';
    const toolCallId2 = 'tool-456'; // The one we'll cancel
    
    // Mock findToolCall to return the second tool call
    (findToolCall as any).mockReturnValue({
      toolCallId: toolCallId2,
      status: 'generating',
      toolCall: { 
        id: toolCallId2, 
        type: 'function', 
        function: { name: 'testTool2', arguments: '{}' } 
      },
      parsedArgs: {}
    });
    
    // Mock state with multiple tool calls
    const getState = () => ({
      session: {
        history: [
          { message: { id: '1', role: 'user', content: 'Use tools' }, contextItems: [] },
          { 
            message: { 
              id: '2', 
              role: 'assistant', 
              content: 'Using first tool...',
              toolCalls: [{ id: toolCallId1, type: 'function', function: { name: 'testTool1', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId: toolCallId1,
              status: 'done', // This one is done
              toolCall: { id: toolCallId1, type: 'function', function: { name: 'testTool1', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          },
          { 
            message: { 
              id: '3', 
              role: 'tool', 
              content: 'First tool result', 
              toolCallId: toolCallId1 
            },
            contextItems: []
          },
          { 
            message: { 
              id: '4', 
              role: 'assistant', 
              content: 'Using second tool...',
              toolCalls: [{ id: toolCallId2, type: 'function', function: { name: 'testTool2', arguments: '{}' } }]
            },
            toolCallState: {
              toolCallId: toolCallId2,
              status: 'generating', // This one is still generating and will be cancelled
              toolCall: { id: toolCallId2, type: 'function', function: { name: 'testTool2', arguments: '{}' } },
              parsedArgs: {}
            },
            contextItems: []
          }
        ]
      }
    });

    // Act
    const result = await cancelToolCallAndAddResult(toolCallId2)(mockDispatch, getState, undefined);

    // Assert
    expect(result.payload).toEqual({
      toolCallId: toolCallId2,
      toolResultMessage: {
        message: {
          id: mockUUID,
          role: 'tool',
          content: 'Tool use was cancelled.',
          toolCallId: toolCallId2
        },
        contextItems: []
      }
    });
    
    // Verify findToolCall was called with the correct arguments
    expect(findToolCall).toHaveBeenCalledWith(
      getState().session.history,
      toolCallId2
    );
  });
});
