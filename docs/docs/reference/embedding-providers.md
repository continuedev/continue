---
title: Embeddings Providers
sidebar_label: 🔤 Embeddings Providers
description: Learn about the different embeddings providers supported by Continue, including Cohere, DeepInfra, Free Trial, Gemini, Hugging Face TEI, Ollama, OpenAI, Transformers.js, and Voyage AI.
toc_max_heading_level: 2
---

We support various methods of generating embeddings, which can be configured with the `"embeddingsProvider"` property in `config.json`. We currently have built-in support for the following providers:

## Cohere

Configuration for the `embed-english-v3.0` model. This is the default.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "apiKey": "<COHERE_API_KEY>"
  }
}
```

See Cohere's [embeddings](https://docs.cohere.com/docs/embed-2) for available models. Only embedding models v3 and higher are supported.

## DeepInfra

DeepInfra provides access to various embedding models through their API. The default model is "sentence-transformers/all-MiniLM-L6-v2".

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "deepinfra",
    "model": "sentence-transformers/all-MiniLM-L6-v2", // optional, this is the default
    "apiKey": "<DEEPINFRA_API_KEY>"
  }
}
```

## Free Trial

The Free Trial Embeddings Provider is designed for users testing Continue without setting up their own provider. It uses the "voyage-code-2" model by default.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "free-trial"
  }
}
```

This provider requires no additional configuration and is intended for trial use only.

## Gemini

Gemini's _Text Embedding_ model is optimized for creating embeddings with 768 dimensions for text of up to 2,048 tokens.

As of May 2024, the only available embedding model from Gemini is [`text-embedding-004`](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding-and-embedding).

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "gemini",
    "apiKey": "<GEMINI_API_KEY>"
  }
}
```

## Ollama

[Ollama](https://ollama.ai) is the easiest way to get up and running with open-source language models. It provides an entirely local REST API for working with LLMs, including generating embeddings. We recommend using an embeddings model like `nomic-embed-text`:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "apiBase": "http://localhost:11434" // optional, defaults to http://localhost:11434
  }
}
```

## OpenAI

OpenAI's [embeddings](https://platform.openai.com/docs/guides/embeddings) are high dimensional embeddings that give great performance on both text and code.

### Configuration for the `text-embedding-3-small` model

This is default. The `text-embedding-3-small` model offers an outstanding balance between performance and efficiency, suitable for a versatile range of applications.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

### Configuration for the `text-embedding-3-large` model

For those requiring the highest level of embedding detail and precision, the `text-embedding-3-large` model is the better choice.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

### Legacy Model Configuration

For certain scenarios, you may still find the `text-embedding-ada-002` model relevant. Below is the configuration example:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<your custom OpenAI-compatible endpoint>", // optional, defaults to OpenAI's API
    "apiKey": "<OPENAI_API_KEY>"
  }
}
```

## Text Embeddings Inference (TEI)

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) allows you to host your own embeddings endpoint.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "huggingface-tei",
    "apiBase": "http://localhost:8080", // Default, change if your endpoint is different
    "model": "tei" // Optional, automatically updated with actual model ID from server
  }
}
```

Note: Ensure your TEI server is running and accessible at the specified `apiBase`.

## Transformers.js (currently VS Code only)

[Transformers.js](https://huggingface.co/docs/transformers.js/index) is a JavaScript port of the popular [Transformers](https://huggingface.co/transformers/) library. It allows embeddings to be calculated locally in the browser (or in this case inside of the sidebar of your IDE). The model used is `all-MiniLM-L6-v2`, which is shipped alongside the Continue extension and generates embeddings of size 384.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

## Voyage AI

Voyage AI offers the best embeddings for code with their voyage-code-2 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "voyage-code-2",
    "apiBase": "https://api.voyageai.com/v1/",
    "apiKey": "<VOYAGE_API_KEY>"
  }
}
```
