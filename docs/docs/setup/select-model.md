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

*We currently reccommend the following open-source models:*

#### Llama 3 from Meta

Unlimited GPU: s

Limited GPU: 

You should use `llama3-70b` right now. If it's not possible, you could try `llama3-8B` instead.

#### DeepSeek Coder from DeepSeek

You should use `deepseek-coder-33b` right now. If it's not possible, you could try `deepseek-coder-6.7b` instead.

*You can also use other open-source chat models by adding them to your `config.json`.*

### Commercial LLMs

#### Claude 3 from Anthropic

You should use `claude-3-opus-20240229` or `claude-3-sonnet-20240229` right now.

#### GPT-4 Turbo from OpenAI

You should use `gpt-4-turbo-2024-04-09` right now.

#### Gemini Pro from Google

You should use `gemini-pro-1.5-latest` right now.

*You can also use other commercial chat models by adding them to your `config.json`.*

## Autocomplete

You likely want to use a model that is 1-15B parameters for autocomplete.

### Open-source LLMs

*We currently reccommend the following open-source models:*

#### DeepSeek Coder from DeepSeek

You should use `deepseek-coder-6.7b` right now. If it's not possible, you could try `deepseek-coder-1.3b` instead.

#### StarCoder 2 from Hugging Face

`starcoder-2-7b` is the best right now. If it's not possible, you could try `starcoder-2-3b` instead.

*You can also use other autocomplete models by adding them to your `config.json`.*

## Embeddings

You likely want to use an embeddings model that is made to vectorize code.

### Open-source models

You should use `transformers.js` or `nomic-embed-text` right now.

### Commercial models

You should use `voyage-code-2` right now.

*You can also use other embeddings models by adding them to your `config.json`.*

**In addition to selecting models, you will need to figure out [what providers to use](./select-provider.md).**