---
title: Ollama
slug: ../ollama
---

Ollama is an open-source tool that allows to run large language models (LLMs) locally on their own computers. To use Ollama, you can install it [here](https://ollama.ai/download) and download the model you want to run with the `ollama run` command.

## Chat model

We recommend configuring **Llama3.1 8B** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Llama3.1 8B",
      "provider": "ollama",
      "model": "llama3.1:8b"
    }
  ]
}
```

## Autocomplete model

We recommend configuring **Qwen2.5-Coder 1.5B** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 1.5B",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b"
  }
}
```

## Embeddings model

We recommend configuring **Nomic Embed Text** as your embeddings model.

```json title="config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```

## Reranking model

Ollama currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.
