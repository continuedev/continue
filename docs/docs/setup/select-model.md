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

*We currently recommend the following open-source models:*

#### Llama 3 from Meta

- Unlimited GPU: `llama3-70b`
- Limited GPU: `llama3-8B`

#### DeepSeek Coder from DeepSeek

- Unlimited GPU: `deepseek-coder-33b`
- Limited GPU: `deepseek-coder-6.7b`

*You can also use other open-source chat models by adding them to your `config.json`.*

### Commercial LLMs

#### Claude 3 from Anthropic

- Unlimited budget: `claude-3-opus-20240229`
- Limited budget: `claude-3-sonnet-20240229`

#### GPT-4o from OpenAI

- Unlimited budget: `gpt-4o`
- Limited budget: `gpt-3.5-turbo-0125`

#### Gemini Pro from Google

- Unlimited budget: `gemini-pro-1.5-latest`
- Limited budget: `gemini-pro-1.0`

*You can also use other commercial chat models by adding them to your `config.json`.*

## Autocomplete

You likely want to use a model that is 1-15B parameters for autocomplete.

### Open-source LLMs

*We currently recommend the following open-source models:*

#### DeepSeek Coder from DeepSeek

- Unlimited GPU: `deepseek-coder-6.7b`
- Limited GPU: `deepseek-coder-1.3b`

#### StarCoder 2 from Hugging Face

- Unlimited GPU: `starcoder-2-7b`
- Limited GPU: `starcoder-2-3b`

*You can also use other autocomplete models by adding them to your `config.json`.*

## Embeddings

You likely want to use an embeddings model that is made to vectorize code.

### Open-source models

- `transformers.js`
- `nomic-embed-text`

### Commercial models

- `voyage-code-2`



*You can also use other embeddings models by adding them to your `config.json`.*

**In addition to selecting models, you will need to figure out [what providers to use](./select-provider.md).**
