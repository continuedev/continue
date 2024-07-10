---
title: Select models
description: Configure LLMs
keywords: [llama-3, gpt-4, claude-3, gemini-pro, deepseek]
---

# Select models

Continue makes it easy to use different models for chat, autocomplete, and embeddings. To select the models you want to use, add them to your `config.json`.

## Chat

You likely want to use a model that is 30B+ parameters for chat.

### Open-source LLMs

_We currently recommend the following open-source models:_

#### Llama 3 from Meta

- Unlimited GPU: `llama3-70b`
- Limited GPU: `llama3-8B`

#### DeepSeek Coder v2 from DeepSeek

- Unlimited GPU: `deepseek-coder-v2:236b`
- Limited GPU: `deepseek-coder-v2:16b`

_You can also use other open-source chat models by adding them to your `config.json`._

### Commercial LLMs

#### Claude 3 from Anthropic

- Unlimited budget: `claude-3-5-sonnet-20240620`
- Limited budget: `claude-3-5-sonnet-20240620`

#### GPT-4o from OpenAI

- Unlimited budget: `gpt-4o`
- Limited budget: `gpt-3.5-turbo-0125`

#### Gemini Pro from Google

- Unlimited budget: `gemini-pro-1.5-latest`
- Limited budget: `gemini-flash-1.5-latest` or `gemini-pro-1.0`

_You can also use other commercial chat models by adding them to your `config.json`._

## Autocomplete

You likely want to use a model that is 1-15B parameters for autocomplete.

### Commercial LLMs

#### Codestral from Mistral

Our current recommendation for autocomplete, if you are able to choose any model, is `codestral-latest` from [Mistral's API](../walkthroughs/set-up-codestral.md).

### Open-source LLMs

_We currently recommend the following open-source models:_

#### DeepSeek Coder v2 from DeepSeek

- Unlimited GPU: `deepseek-coder-v2:16b`
- Limited GPU: `deepseek-coder:6.7b` or `deepseek-coder:1.3b`

#### StarCoder 2 from Hugging Face

- Unlimited GPU: `starcoder-2-7b`
- Limited GPU: `starcoder-2-3b`

_You can also use other autocomplete models by adding them to your `config.json`._

## Embeddings

We recommend the following embeddings models, which are used for codebase retrieval as described [here](../walkthroughs/codebase-embeddings.md#embeddings-providers)

### Open-source models

- `nomic-embed-text`

### Commercial models

- `voyage-code-2`

_You can also use other embeddings models by adding them to your `config.json`._

**In addition to selecting models, you will need to figure out [what providers to use](./select-provider.md).**
