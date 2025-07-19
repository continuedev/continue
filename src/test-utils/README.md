# Chat History Replay Testing Framework

This testing framework allows you to replay chat conversations and validate UI behavior at each step.

## Components

### 1. Chat History Test Utilities (`chatHistoryTestUtils.ts`)
- **Types**: Core interfaces for test scenarios and steps
- **Message builders**: Helper functions to create test messages
- **Basic validators**: Simple validation functions

### 2. Mock LLM Handler (`mockLLMHandler.ts`)
- **StaticMockLLMHandler**: Uses predefined responses based on message content
- **DynamicMockLLMHandler**: Uses custom response generator functions
- Simulates streaming responses and tool execution

### 3. Chat History Replay Framework (`chatHistoryReplayFramework.tsx`)
- Core framework for replaying conversations
- Renders TUIChat component with mocked dependencies
- Steps through conversation history and validates UI state

### 4. UI Validation Helpers (`uiValidationHelpers.ts`)
- Advanced validation functions
- Common validation scenarios
- Custom validator creation utilities

## Usage

### Basic Test Example

```typescript
const scenario: ChatHistoryTestScenario = {
  name: "Simple conversation",
  description: "Test basic Q&A",
  steps: [
    {
      description: "User asks question",
      message: createTestMessage("user", "What is 2+2?"),
      expectedMessages: [
        { role: "user", content: "What is 2+2?" },
      ],
    },
    {
      description: "Assistant responds",
      expectedMessages: [
        { role: "user", content: "What is 2+2?" },
        { role: "assistant", content: "4" },
      ],
    },
  ],
  mockResponses: [
    {
      forMessage: "What is 2+2?",
      response: createTestMessage("assistant", "4"),
    },
  ],
};

await runChatHistoryScenario(scenario);
```

### Tool Usage Test

```typescript
const scenario: ChatHistoryTestScenario = {
  name: "Tool usage",
  description: "Test tool calls",
  steps: [
    {
      description: "User requests file operation",
      message: createTestMessage("user", "List files"),
      expectedMessages: [
        { role: "user", content: "List files" },
      ],
    },
    {
      description: "Tool executes",
      expectedMessages: [
        { role: "user", content: "List files" },
        { role: "assistant", content: "", messageType: "tool-start", toolName: "listFiles" },
        { role: "tool", content: "file1.ts, file2.ts", messageType: "tool-result" },
        { role: "assistant", content: "Found 2 files" },
      ],
    },
  ],
  mockResponses: [
    {
      forMessage: "List files",
      response: [
        createToolCallMessage("listFiles", { path: "./" }),
        createTestMessage("assistant", "Found 2 files"),
      ],
    },
  ],
};
```

### Custom Validation

```typescript
const customValidator = createCustomValidator(
  "Check formatting",
  (messages) => {
    const assistantMsg = messages.find(m => m.role === "assistant");
    if (assistantMsg) {
      uiValidationHelpers.validateMarkdownFormatting(assistantMsg, ["bold", "code"]);
    }
  }
);

// Use in test step
{
  description: "Validate formatting",
  expectedMessages: [...],
  validate: customValidator.validate,
}
```

## Running Tests

```bash
npm test src/ui/TUIChat.test.tsx
npm test src/ui/TUIChat.advanced.test.tsx
```

## Best Practices

1. **Use descriptive scenario names**: Help identify failing tests
2. **Test one behavior per scenario**: Keep tests focused
3. **Mock responses appropriately**: Match the conversation context
4. **Validate both content and state**: Check message content and UI state
5. **Use streaming for long responses**: Test real-world behavior
6. **Handle async operations**: Use proper delays for streaming

## Extending the Framework

To add new validation capabilities:

1. Add new validation functions to `uiValidationHelpers.ts`
2. Create new common scenarios in `commonValidationScenarios`
3. Extend `DisplayMessage` type if needed for new UI states
4. Add new mock tool responses in `MockLLMHandler`