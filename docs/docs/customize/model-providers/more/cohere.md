# Cohere

Before using Cohere, visit the [Cohere dashboard](https://dashboard.cohere.com/api-keys) to create an API key.

## Chat model

We recommend configuring **Command-R Plus** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Cohere",
      "provider": "cohere",
      "model": "command-r-plus",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

## Autocomplete model

Cohere currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring **embed-english-v3.0** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

## Reranking model

We recommend configuring **rerank-english-v3.0** as your reranking model.

```json title="config.json"
{
  "reranker": {
    "provider": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```
