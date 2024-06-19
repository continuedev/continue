# Example configurations

If you're looking for a quick way to create the perfect Continue setup, we've written a few sample `config.json`s for common situations. You can copy these and paste them into your `config.json` by clicking the gear icon in the bottom right of the Continue sidebar.

## I just want the best experience possible

This uses Claude 3 Opus for chat, Codestral for autocomplete, and Voyage AI for embeddings and reranking.

### Pre-requisites

1. Obtain a Codestral API key from [Mistral AI's La Plateforme](https://console.mistral.ai/codestral)

2. Obtain an Anthropic API key from [here](https://console.anthropic.com/account/keys)

3. Replace `[CODESTRAL_API_KEY]` and `[ANTHROPIC_API_KEY]` with the keys you obtained in the previous steps.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Claude 3 Opus",
      "provider": "anthropic",
      "model": "claude-3-opus-20240229",
      "apiKey": "[ANTHROPIC_API_KEY]"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "[CODESTRAL_API_KEY]"
  },
  "embeddingsProvider": {
    "provider": "free-trial"
  },
  "reranker": {
    "name": "free-trial"
  }
}
```

## I need to be entirely local + offline

This uses Ollama for chat, autocomplete, and embeddings, making sure that no code ever leaves your machine.

### Pre-requisites

1. [Download Ollama](https://ollama.ai)

2. Pull the necessary models

   i. For chat: `ollama run llama3:8b`

   ii. For autocomplete: `ollama run starcoder2:3b`

   iii. For embeddings: `ollama run nomic-embed-text`

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Starcoder 2 3b",
    "provider": "ollama",
    "model": "starcoder2:3b"
  },
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```
