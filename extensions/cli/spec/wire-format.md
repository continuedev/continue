# HTTP Wire Protocol: `cn remote` � `cn serve`

This document describes the HTTP protocol used for communication between the `cn remote` client and `cn serve` server

## Overview

The protocol uses a polling-based REST API where:

- The server (`cn serve`) runs an Express HTTP server on port 3000
- The client (`cn remote`) polls the server every 500ms for state updates
- All communication uses JSON payloads

## Endpoints

### `GET /state`

Returns the current chat state including message history and processing status.

**Response:**

```json
{
  "chatHistory": [
    {
      "role": "user" | "assistant" | "system",
      "content": "string",
      "isStreaming": boolean,
      "messageType": "tool-start" | "tool-result" | "tool-error" | "system",
      "toolName": "string",
      "toolResult": "string"
    }
  ],
  "isProcessing": boolean,
  "messageQueueLength": number
}
```

### `POST /message`

Sends a user message to the server. Messages are queued and processed sequentially.

**Request Body:**

```json
{
  "message": "string"
}
```

**Response:**

```json
{
  "queued": true,
  "position": number,
  "willInterrupt": boolean
}
```

**Special Cases:**

- Empty message (`""`) interrupts current processing
- Message `/exit` initiates server shutdown

### `GET /diff`

Returns the git diff between the current branch and main branch.

**Response (Success):**

```json
{
  "diff": "string"
}
```

**Response (Error):**

- 404: Not in a git repository
- 500: Git command failed

### `POST /exit`

Gracefully shuts down the server.

**Response:**

```json
{
  "message": "Server shutting down",
  "success": true
}
```

## Message Types

Messages in the chat history can have different types:

- **Regular messages**: Standard user/assistant messages
- **Tool messages**: Messages with `messageType` set to:
  - `tool-start`: Tool execution started
  - `tool-result`: Tool execution completed
  - `tool-error`: Tool execution failed
  - `system`: System messages

## Protocol Flow

1. **Client starts**: Begins polling `GET /state` every 500ms
2. **User sends message**: Client posts to `POST /message`
3. **Server queues message**: Returns queue position
4. **Server processes**: Updates state with streaming responses
5. **Client displays**: Shows updates from state polling
6. **Interruption**: Client sends empty message to interrupt
7. **Exit**: Client sends `/exit` or `POST /exit` to shutdown

## Implementation Files

### Server Implementation

- **Main server**: `src/commands/serve.ts:51-363`
  - Express server setup
  - Endpoint handlers
  - State management
  - Message processing

### Client Implementation

- **Remote chat hook**: `src/ui/hooks/useChat.ts:170-310`
  - State polling logic
  - Message sending
  - Interrupt handling

### Type Definitions

- **Display message types**: `src/ui/types.ts:1-16`
- **Server state interface**: `src/commands/serve.ts:20-33`

### Testing

- **Mock server**: `src/ui/__tests__/mockRemoteServer.ts`
  - Complete mock implementation for testing
  - Simulates streaming and message processing

## Features

### Message Queueing

- Messages are queued and processed one at a time
- Queue position returned on message submission
- Supports interruption of current processing

### Streaming Support

- `isStreaming` flag indicates ongoing response
- Character-by-character updates for real-time display

### Auto-shutdown

- Server shuts down after timeout (default: 300 seconds)
- Configurable via `--timeout` flag

### Error Handling

- HTTP status codes for error conditions
- Graceful error messages in responses

## Security Considerations

- Server binds to `127.0.0.1` (localhost only)
- No authentication implemented (local use only)
- File system access through tool execution
