---
title: Model setup
description: How to set up Chat model
keywords: [model]
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Model setup

:::info
This page recommends models and providers for Chat. Read more about how to set up your `config.json` [here](../reference/config.mdx).
:::

## Best overall experience

For the best overall Chat experience, you will want to use a 400B+ parameter model or one of the frontier models.

#### Claude Sonnet 3.5 from Anthropic

Our current top recommendation is Claude Sonnet 3.5 from [Anthropic](../reference/Model%20Providers/anthropicllm.md).

```json title="config.json"
 "models": [
   {
     "title": "Claude 3.5 Sonnet",
     "provider": "anthropic",
     "model": "claude-3-5-sonnet-20240620",
     "apiKey": "[ANTHROPIC_API_KEY]"
   }
 ]
```

#### Llama 3.1 405B from Meta

If you prefer to use an open-weight model, then Llama 3.1 405B from Meta is your best option right now. You will need to decide if you use it through a SaaS model provider (e.g. [Together](../reference/Model%20Providers/togetherllm.md) or [Groq](../reference/Model%20Providers/groq.md)) or self-host it (e.g. using [vLLM](../reference/Model%20Providers/vllm.md) or [Ollama](../reference/Model%20Providers/ollama.md)).

<Tabs>

<TabItem value="Together">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 405B",
                "provider": "together",
                "model": "llama3.1-405b",
                "apiKey": "[TOGETHER_API_KEY]"
            }
        ]
    ```

 </TabItem>
    
<TabItem value="groq" label="Groq">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 405B",
                "provider": "groq",
                "model": "llama3.1-405b",
                "apiKey": "[GROQ_API_KEY]"
            }
        ]
    ```

</TabItem>

<TabItem value="vllm" label="vLLM">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 405B",
                "provider": "vllm",
                "model": "llama3.1-405b"
            }
        ]
    ```

</TabItem>

<TabItem value="ollama" label="Ollama">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 405B",
                "provider": "ollama",
                "model": "llama3.1-405b"
            }
        ]
    ```

</TabItem>

</Tabs>

#### GPT-4o from OpenAI

If you prefer to use a model from [OpenAI](../reference/Model%20Providers/openai.md), then we recommend GPT-4o.

```json title="config.json"
 "models": [
   {
     "title": "GPT-4o",
     "provider": "openai",
     "model": "",
     "apiKey": "[OPENAI_API_KEY]"
   }
 ]
```

#### Gemini 1.5 Pro from Google

If you prefer to use a model from [Google](../reference/Model%20Providers/geminiapi.md), then we recommend Gemini 1.5 Pro.

```json title="config.json"
  "models": [
    {
      "title": "Gemini 1.5 Pro",
      "provider": "gemini",
      "model": "gemini-1.5-pro-latest",
      "apiKey": "[GEMINI_API_KEY]"
    }
  ]
```

## Local, offline experience

For the best local, offline Chat experience, you will want to use a model that is large but fast enough on your machine.

#### Llama 3.1 8B

If your local machine can run an 8B parameter model, then we recommend running Llama 3.1 8B on your machine (e.g. using [Ollama](../reference/Model%20Providers/ollama.md) or [LM Studio](../reference/Model%20Providers/lmstudio.md)).

<Tabs>

<TabItem value="ollama" label="Ollama">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 8B",
                "provider": "ollama",
                "model": "llama3.1-8b"
            }
        ]
    ```

</TabItem>

<TabItem value="lmstudio" label="LM Studio">

    ```json title="config.json"
        "models": [
            {
                "title": "Llama 3.1 8B",
                "provider": "lmstudio",
                "model": "llama3.1-8b"
            }
        ]
    ```

</TabItem>

</Tabs>


#### DeepSeek Coder 2 16B

If your local machine can run a 16B parameter model, then we recommend running DeepSeek Coder 2 16B (e.g. using [Ollama](../reference/Model%20Providers/ollama.md) or [LM Studio](../reference/Model%20Providers/lmstudio.md)).

<Tabs>

<TabItem value="ollama" label="Ollama">

    ```json title="config.json"
        "models": [
            {
                "title": "DeepSeek Coder 2 16B",
                "provider": "ollama",
                "model": "deepseek-coder-v2:16b"
            }
        ]
    ```

</TabItem>

<TabItem value="lmstudio" label="LM Studio">

    ```json title="config.json"
        "models": [
            {
                "title": "DeepSeek Coder 2 16B",
                "provider": "lmstudio",
                "model": "deepseek-coder-v2:16b"
            }
        ]
    ```

</TabItem>

</Tabs>

## Other experiences

There are many more models and providers you can use with Chat beyond those mentioned above. Read more [here](../reference).