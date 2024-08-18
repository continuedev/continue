---
title: Custom LLM Provider
description: Learn how to define and configure a custom Large Language Model (LLM) provider in Continue, including implementing stream completion functions and setting up model options.
keywords: [custom LLM, model provider, Continue configuration, stream completion, API integration, LLM setup]
---

If you are using an LLM API that isn't already [supported by Continue](../reference/config), and is not an OpenAI-compatible API, you'll need to define a `CustomLLM` object in `config.ts`. This object only requires one of (or both of) a `streamComplete` or `streamChat` function. Here is an example:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.models.push({
    options: {
      title: "My Custom LLM",
      model: "mistral-7b",
    },
    streamCompletion: async function* (
      prompt: string,
      options: CompletionOptions,
      fetch,
    ) {
      // Make the API call here

      // Then yield each part of the completion as it is streamed
      // This is a toy example that will count to 10
      for (let i = 0; i < 10; i++) {
        yield `- ${i}\n`;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
  });
  return config;
}
```
