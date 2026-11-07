# HTTP Wire Protocol: `cn remote` � `cn serve`

This document describes the HTTP protocol used for communication between the `cn remote` client and `cn serve` server

## Overview

The protocol uses a polling-based REST API where:

- The server (`cn serve`) runs an Express HTTP server on port 3000
- The client (`cn remote`) polls the server every 500ms for state updates
- All communication uses JSON payloads

## Endpoints

### `GET /state`

Returns the current chat state including message history, processing status and the message queue.

**Response:**

```json
{
  "session": {
    "sessionId": "string",
    "title": "string",
    "workspaceDirectory": "string",
    "history": ChatHistoryItem[]
  },
  "isProcessing": boolean,
  "messageQueueLength": number,
  "messageQueue": [
    {
      "id": "string",
      "message": "string",
      "timestamp": number,
      "steer": boolean
    }
  ],
  "messageQueuePaused": boolean,
  "steerRequested": boolean,
  "pendingPermission": null | {
    "toolName": "string",
    "toolArgs": object,
    "requestId": "string",
    "timestamp": number,
    "toolCallPreview": array
  }
}
```

- `messageQueue` lists what is queued, oldest first. `steer` is true for a message that goes at the next tool boundary of the running turn rather than at its end.
- `messageQueuePaused` is true after `POST /pause`: nothing queued is sent until the next `POST /message`.
- `steerRequested` is true while a steer is waiting for a tool boundary.
- `messageQueue`, `messageQueuePaused` and `steerRequested` were added after the other fields; older servers omit them.

### `POST /message`

Sends a user message to the server. Messages are queued; when the current turn ends, everything queued goes to the model as one message (joined by blank lines). Slash and `!` commands are not merged: each runs on its own, in order. A message sent after `POST /pause` resumes the queue and goes out together with whatever was queued before the pause.

**Request Body:**

```json
{
  "message": "string",
  "steer": boolean
}
```

`steer` is optional. With `steer: true` while a run is in progress, the message is delivered inside that run, as Enter on an empty prompt does in the TUI: at the next tool boundary (after a round of tool calls has finished and before the next model request) it is added as a user message after the tool results, so the model reads it in the same turn. If the run ends without another tool boundary, the message goes out at the end of the turn like any queued message. When nothing is running, `steer` makes no difference.

Steering applies to the queue, not to one message: every plain message queued at that point goes at the boundary together, in order, joined by blank lines, so an earlier message cannot arrive after a later one. Slash and `!` commands are never steered; they wait for the end of the turn. A steered message passes through the `UserPromptSubmit` hooks like any other; if a hook blocks it, a system message saying so is added to the history.

**Response:**

```json
{
  "queued": true,
  "position": number,
  "steered": boolean
}
```

`steered` is true when the message will go at the next tool boundary: `steer` was true, a run was in progress, and the message is not a command.

**Special Cases:**

- A missing or empty `message` is rejected with 400. To interrupt, use `POST /pause`.
- A `steer` that is not a boolean is rejected with 400.
- Message `/exit` initiates server shutdown

### `POST /pause`

Stops the current agent run, as Esc does in the TUI. The queue is kept but paused: nothing queued is sent until the next `POST /message`. A pending steer is cancelled; the steered messages stay queued.

**Response:**

```json
{
  "success": boolean,
  "message": "Agent run paused" | "No active processing to pause"
}
```

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
6. **Interruption**: Client sends `POST /pause`
7. **Exit**: Client sends `/exit` or `POST /exit` to shutdown

## Implementation Files

### Server Implementation

- **Main server**: `src/commands/serve.ts`
  - Express server setup
  - `/permission`, `/diff` and `/exit` handlers
- **Messages**: `src/commands/serve.messages.ts`
  - `/state`, `/message` and `/pause` handlers
  - Message processing
- **Steering at the tool boundary**: `buildServeSteeringMessage` in `src/commands/serve.helpers.ts`

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

- Messages queued during a turn are sent together, as one message, when it ends
- Queue position returned on message submission
- `POST /pause` interrupts the current turn and pauses the queue until the next message
- `POST /message` with `steer: true` delivers the queue at the next tool boundary of the running turn
- `GET /state` lists the queue, marking what is steered

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
