# Free Trial

The `"free-trial"` provider lets new users try out Continue with GPT-4, Llama3, Claude 3, and other models using a proxy server that securely makes API calls to these services. Continue should just work the first time you install the extension.

While the Continue extension is always free to use, we cannot support infinite free LLM usage for all of our users. You will eventually need to either:

1. Select an open-source model to use for free locally, or
2. Add your own API key for OpenAI, Anthropic, or another LLM provider

## Options

### 🦙 Ollama (free, local)

Ollama is a local service that makes it easy to run language models on your laptop.

1. Download Ollama from https://ollama.ai
2. Open `~/.continue/config.json`. You can do this by clicking the gear icon in the bottom right corner of the Continue sidebar
3. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama3 8b",
      "provider": "ollama",
      "model": "llama3:8b"
    }
  ]
}
```

### ⚡️ Groq (extremely fast)

Groq provides lightning fast inference for open-source LLMs like Llama3, up to twice as fast as through other providers.

1. Obtain an API key from https://console.groq.com
2. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Llama3 70b",
      "provider": "groq",
      "model": "llama3-70b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

### ✨ OpenAI (highly capable)

1. Copy your API key from https://platform.openai.com/account/api-keys
2. Add the following to your `config.json`:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

### ⏩ Other options

The above were only a few examples, but Continue can be used with any LLM or provider. You can find [a full list of providers here](../../setup/select-provider.md).
