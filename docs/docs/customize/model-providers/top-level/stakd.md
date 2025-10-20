---
title: "How to Configure Stakd Backend with Continue"
sidebarTitle: "Stakd"
---

## Overview

Stakd is a custom backend provider that connects to your local backend API running at `localhost:8080`. It provides OpenAI-compatible streaming chat completions through your backend infrastructure.

## Configuration

Add the following configuration to your `config.yaml` or `config.json`:

### YAML Configuration

```yaml title="config.yaml"
models:
  - name: Stakd Backend
    provider: stakd
    model: stakd-backend
```

### JSON Configuration (Deprecated)

```json title="config.json"
{
  "models": [
    {
      "title": "Stakd Backend",
      "provider": "stakd",
      "model": "stakd-backend"
    }
  ]
}
```

## Features

- **Hardcoded Backend URL**: Automatically connects to `http://localhost:8080/v1/`
- **No Authentication Required**: No API keys needed for local development
- **OpenAI-Compatible**: Supports standard OpenAI streaming chat completion format
- **Backend-Controlled Models**: Model selection is handled entirely by your backend

## Model Configuration

The model parameter is set to `stakd-backend` by default. Your backend will receive this identifier and can route to the appropriate model internally:

```yaml
models:
  - name: Stakd Backend
    provider: stakd
    model: stakd-backend
```

**Note**: The model parameter is passed to your backend but model selection and routing should be handled by your backend implementation.

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
