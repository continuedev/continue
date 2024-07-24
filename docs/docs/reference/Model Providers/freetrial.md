# Free Trial

The `"free-trial"` provider lets new users try out Continue with GPT-4, Llama3, Claude 3, and other models using a proxy server that securely makes API calls to these services. Continue will just work the first time you install the extension. To prevent abuse, we will ask you to sign in with GitHub, which you can [read more about below](#sign-in).

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

The above were only a few examples, but Continue can be used with any LLM or provider. You can find [a full list of model providers here](../../setup/model-providers.md).

## Sign in

Continue asks free trial users to sign in so that we can prevent abuse of our API endpoints. If you are not using the free trial, we will never ask you to sign in.

### How do I stop Continue from asking me to sign in?

Remove all models from the "models" array with `"provider": "free-trial"`, and we will never request sign in.

### What information is collected?

Continue uses your GitHub username and no other information, for the sole purpose of limiting requests.

### What happens if I don't sign in?

If you don't sign in, you can still use every feature of Continue, you will just need to provide your own LLM either with an API key or by running a local model.

### How is telemetry related to sign in?

It is not. We do not link your GitHub username to telemetry data.
