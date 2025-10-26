---
title: "How to Configure Stakd Backend with Continue"
sidebarTitle: "Stakd"
---

## Overview

Stakd is a custom backend provider that connects to your local backend API running at `localhost:8080`. It provides OpenAI-compatible streaming chat completions through your backend infrastructure.

## Configuration

Add the following configuration to your `config.yaml` or `config.json`. You can specify any model name - the provider will route all requests through your local backend:

### YAML Configuration

```yaml title="config.yaml"
models:
  - name: GPT-4 via Stakd
    provider: stakd
    model: gpt-4o
  - name: Claude via Stakd
    provider: stakd
    model: claude-3-5-sonnet-20241022
  - name: Custom Model
    provider: stakd
    model: my-custom-model
```

### JSON Configuration (Deprecated)

```json title="config.json"
{
  "models": [
    {
      "title": "GPT-4 via Stakd",
      "provider": "stakd",
      "model": "gpt-4o"
    },
    {
      "title": "Claude via Stakd",
      "provider": "stakd",
      "model": "claude-3-5-sonnet-20241022"
    }
  ]
}
```

## Features

- **Hardcoded Backend URL**: Automatically connects to `http://localhost:8080/v1/`
- **No Authentication Required**: No API keys needed for local development
- **OpenAI-Compatible**: Supports standard OpenAI streaming chat completion format
- **Flexible Model Selection**: You specify the model name, and your backend routes to the appropriate LLM

## Model Configuration

You can use any model identifier you want. The model parameter is passed directly to your backend, which can route to any LLM:

```yaml
models:
  # Use OpenAI model identifiers
  - name: GPT-4 Turbo
    provider: stakd
    model: gpt-4-turbo-preview

  # Use Anthropic model identifiers
  - name: Claude Opus
    provider: stakd
    model: claude-3-opus-20240229

  # Use custom identifiers your backend understands
  - name: My Fine-tuned Model
    provider: stakd
    model: company-model-v2
```

**Note**: The model parameter you specify is sent to your backend in the request. Your backend is responsible for routing to the appropriate LLM based on this identifier.

## Backend Requirements

Your backend must:

1. Run on `localhost:8080`
2. Implement the `/v1/chat/completions` endpoint
3. Accept OpenAI-compatible request format:
   ```json
   {
     "model": "stakd-backend",
     "messages": [
       {
         "role": "user",
         "content": "Your message here"
       }
     ],
     "stream": true
   }
   ```
4. Handle model routing internally based on the `model` parameter
5. Return OpenAI-compatible streaming response chunks

## Example Backend Request

```bash
curl -N -X POST "http://localhost:8080/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "stakd-backend",
    "messages": [
      {
        "role": "user",
        "content": "Write a haiku about streaming data"
      }
    ],
    "stream": true
  }'
```

## Troubleshooting

### Backend Not Running

**Error**: Connection refused to `localhost:8080`

**Solution**: Ensure your backend is running and accessible at `http://localhost:8080`

### Invalid Response Format

**Error**: Unexpected response format

**Solution**: Verify your backend returns OpenAI-compatible `ChatCompletionChunk` format:

```json
{
  "id": "unique-id",
  "object": "chat.completion.chunk",
  "created": 1234567890,
  "model": "stakd-backend",
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "chunk of text"
      },
      "finish_reason": null
    }
  ]
}
```

## Notes

- The backend URL is hardcoded to `localhost:8080` and cannot be configured
- No API key or authentication is required
- The model parameter is always set to `stakd-backend` - your backend should handle model routing
- The provider automatically uses the OpenAI adapter for compatibility
- Supports all standard completion options (temperature, max_tokens, etc.)
