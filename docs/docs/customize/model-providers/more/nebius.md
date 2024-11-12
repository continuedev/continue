# Nebius AI Studio

You can get an API key from the [Nebius AI Studio API keys page](https://studio.nebius.ai/settings/api-keys)

## Availible models

Available models can be found on the [Nebius AI Studio models page](https://studio.nebius.ai/models/text2text)

## Chat model

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "nebius",
      "model": "llama3.1-405b",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## Embeddings model

Available models can be found on the [Nebius AI Studio embeddings page](https://studio.nebius.ai/models/embedding)

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "nebius",
    "model": "BAAI/bge-en-icl",
    "apiKey": "[API_KEY]"
  }
}
```
