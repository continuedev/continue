---
title: Function Network
slug: ../function-network
---
# Function Network

> Private, Affordable User-Owned AI

:::info

To get an API key, login to the Function Network Developer Platform. If you don't have an account, you can create one [here](https://www.function.network/join-waitlist).

:::

## Chat model

Function Network supports a number of models for chat. We recommend using LLama 3.1 70b or Qwen2.5-Coder-32B-Instruct.

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 70b",
      "provider": "function-network",
      "model": "meta/llama-3.1-70b-instruct",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[Click here](https://docs.function.network/models-supported/chat-and-code-completion) to see a list of chat model providers.

## Autocomplete model

Function Network supports a number of models for autocomplete. We recommend using Llama 3.1 8b or Qwen2.5-Coder-1.5B.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Deepseek Coder 6.7b",
    "provider": "function-network",
    "model": "thebloke/deepseek-coder-6.7b-base-awq",
    "apiKey": "YOUR_API_KEY"
  }
}
```

## Embeddings model

Function Network supports a number of models for embeddings. We recommend using baai/bge-base-en-v1.5.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "function-network",
    "model": "baai/bge-base-en-v1.5",
    "apiKey": "YOUR_API_KEY"
  }
}
```

[Click here](https://docs.function.network/models-supported/embeddings) to see a list of embeddings model providers.

## Reranking model

Function Network currently does not offer any reranking models.
