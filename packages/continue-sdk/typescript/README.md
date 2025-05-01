# @continuedev/sdk

The official TypeScript SDK for [Continue](https://continue.dev), providing a drop-in replacement for OpenAI libraries to easily integrate with Continue assistants.

## Installation

```bash
npm install @continuedev/sdk
```

## Usage

The SDK provides a `Continue.from()` method that initializes an assistant and returns a client you can use as a drop-in replacement for the OpenAI SDK:

```typescript
import { Continue } from "@continuedev/sdk";

// Initialize the Continue client with your API key and assistant
const { client, assistant } = await Continue.from({
  apiKey: process.env.CONTINUE_API_KEY,
  assistant: "owner-slug/assistant-slug", // The assistant identifier
});

// Use the client just like the OpenAI SDK
const response = await client.chat.completions.create({
  model: assistant.getModel("claude-3-7-sonnet-latest"), // Use the assistant's model
  messages: [
    { role: "system", content: assistant.systemMessage }, // Use the assistant's system message
    { role: "user", content: "Hello!" },
  ],
});

console.log(response.choices[0].message.content);
```

## API Reference

### Continue.from(options)

Creates a Continue instance with a pre-configured OpenAI client and assistant.

#### Options

- `apiKey` (string, required): Your Continue API key
- `assistant` (string, required): The assistant identifier in the format `owner-slug/assistant-slug`
- `organizationId` (string, optional): Optional organization ID
- `baseURL` (string, optional): Base URL for the Continue API (defaults to `https://api.continue.dev/`)

#### Returns

An object containing:

- `client`: An OpenAI-compatible client configured to use the Continue API
- `assistant`: The assistant configuration with utility methods
- `api`: The raw Continue API client for direct API access
