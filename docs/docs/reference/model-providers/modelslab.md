# ModelsLab

[ModelsLab](https://modelslab.com) provides uncensored Llama 3.1 language models through an OpenAI-compatible API. Ideal for code assistance, creative writing, and use cases where standard content restrictions are too limiting.

**Context window:** 128K tokens  
**Docs:** https://docs.modelslab.com/uncensored-chat  
**API key:** https://modelslab.com/dashboard

## Models

| Model ID | Description |
|---|---|
| `llama-3.1-8b-uncensored` | Fast, efficient — good for most coding tasks (default) |
| `llama-3.1-70b-uncensored` | Higher quality — better reasoning and generation |

## Configuration

### Basic setup

```json title="config.json"
{
  "models": [
    {
      "title": "ModelsLab Llama 3.1 8B",
      "provider": "modelslab",
      "model": "llama-3.1-8b-uncensored",
      "apiKey": "YOUR_MODELSLAB_API_KEY"
    }
  ]
}
```

### Both models

```json title="config.json"
{
  "models": [
    {
      "title": "ModelsLab 8B (Fast)",
      "provider": "modelslab",
      "model": "llama-3.1-8b-uncensored",
      "apiKey": "YOUR_MODELSLAB_API_KEY"
    },
    {
      "title": "ModelsLab 70B (Quality)",
      "provider": "modelslab",
      "model": "llama-3.1-70b-uncensored",
      "apiKey": "YOUR_MODELSLAB_API_KEY"
    }
  ]
}
```

### As autocomplete model

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "ModelsLab Autocomplete",
    "provider": "modelslab",
    "model": "llama-3.1-8b-uncensored",
    "apiKey": "YOUR_MODELSLAB_API_KEY"
  }
}
```

## All options

| Option | Description |
|---|---|
| `provider` | Must be `"modelslab"` |
| `model` | `llama-3.1-8b-uncensored` or `llama-3.1-70b-uncensored` |
| `apiKey` | Your ModelsLab API key |
| `apiBase` | Override API base URL (optional, default: `https://modelslab.com/uncensored-chat/v1/`) |

## Why ModelsLab?

- **Uncensored models** — no content restrictions for research, creative coding, fiction generation
- **128K context** — fit entire files, large codebases, and long conversations
- **Competitive pricing** — cost-effective alternative to premium providers
- **OpenAI-compatible** — seamless integration with Continue's existing infrastructure
