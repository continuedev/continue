# Remote Server API Documentation

## Message Format

The remote server should send messages in the same format as the local Continue CLI to ensure consistent display and functionality.

### Message Structure

Each message in the `chatHistory` array should follow this structure:

```typescript
interface DisplayMessage {
  role: "user" | "assistant" | "system";
  content: string;
  messageType?: "chat" | "tool-start" | "tool-result" | "tool-error" | "system";
  toolName?: string;
  toolResult?: string;
  isStreaming?: boolean;
}
```

### Tool Messages

When the assistant uses tools, the server should send specific message types:

#### Tool Start Message
```json
{
  "role": "system",
  "content": "○ Read(src/file.ts)",
  "messageType": "tool-start",
  "toolName": "read_file"
}
```

#### Tool Result Message
```json
{
  "role": "system",
  "content": "● Read(src/file.ts)",
  "messageType": "tool-result",
  "toolName": "read_file",
  "toolResult": "File contents here..."
}
```

#### Tool Error Message
```json
{
  "role": "system",
  "content": "✗ Tool error: File not found",
  "messageType": "tool-error"
}
```

### Tool Name Mapping

Tool display names should map to tool names as follows:

| Display Name | Tool Name |
|-------------|-----------|
| Read | read_file |
| Write | write_file |
| Bash | run_terminal_command |
| List | list_files |
| Search | search_code |
| Diff | view_diff |
| Fetch | fetch |
| Exit | exit |

### Benefits

By sending messages in this format, the remote server enables:

1. **Consistent UI** - Tool results are displayed with nice summaries using the `ToolResultSummary` component
2. **Better UX** - Long outputs are collapsed, diffs are syntax highlighted, etc.
3. **Proper State Tracking** - The UI can track which tools are running, completed, or errored
4. **No Client-Side Transformation** - The client doesn't need hacky regex parsing to detect tool calls

### Example Response

Here's a complete example of a `/state` response with tool calls:

```json
{
  "chatHistory": [
    {
      "role": "user",
      "content": "Read the README file"
    },
    {
      "role": "system",
      "content": "○ Read(README.md)",
      "messageType": "tool-start",
      "toolName": "read_file"
    },
    {
      "role": "system",
      "content": "● Read(README.md)",
      "messageType": "tool-result",
      "toolName": "read_file",
      "toolResult": "# My Project\n\nThis is a sample README file.\n\n## Installation\n\nRun `npm install`"
    },
    {
      "role": "assistant",
      "content": "I've read the README file. It contains installation instructions that recommend running `npm install`."
    }
  ],
  "isProcessing": false
}
```