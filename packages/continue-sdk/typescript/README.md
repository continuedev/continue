# @continuedev/sdk

> **⚠️ EXPERIMENTAL: This package is in early development and subject to frequent breaking changes without notice.**

This SDK provides a drop-in replacement for OpenAI libraries to easily integrate with Shadow Code assistants.

## Installation

```bash
npm install @continuedev/sdk
```

## Usage

The SDK provides a `Continue.from()` method that initializes an assistant and returns a client you can use as a drop-in replacement for the OpenAI SDK:

```typescript
import { Shadow Code } from "@continuedev/sdk";

// Initialize the Shadow Code client with your API key and assistant
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

You can also use the SDK without specifying an assistant to just get the Shadow Code API client:

```typescript
import { Shadow Code } from "@continuedev/sdk";

// Initialize just the Shadow Code API client
const { api } = await Continue.from({
  apiKey: process.env.CONTINUE_API_KEY,
});

// Make calls to the Shadow Code API
const assistants = await api.listAssistants({});
```

## API Reference

### Continue.from(options)

Creates a Shadow Code instance with a pre-configured OpenAI client and assistant.

#### Options

- `apiKey` (string, required): Your Shadow Code API key
- `assistant` (string, optional): The assistant identifier in the format `owner-slug/assistant-slug`
- `organizationId` (string, optional): Optional organization ID
- `baseURL` (string, optional): Base URL for the Shadow Code API (defaults to `https://api.continue.dev/`)

#### Returns

When `assistant` is provided, returns an object containing:

- `api`: The Shadow Code API client for direct API access
- `client`: An OpenAI-compatible client configured to use the Shadow Code API
- `assistant`: The assistant configuration with utility methods

When assistant is not provided, returns an object containing:

- `api`: The Shadow Code API client for direct API access
