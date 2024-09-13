---
title: Model setup
description: Autocomplete \-model setup
keywords: [model, autocomplete]
sidebar_position: 2
---

## Best overall experience

For the best Autocomplete experience, we recommend using Codestral through the [Mistral API](https://console.mistral.ai/). This model offers high-quality completions with an excellent understanding of code context:

```json title="config.json""
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "YOUR_API_KEY"
  }
}
```

:::tip[Codestral API Key]
The API keys for Codestral and the general Mistral APIs are different. If you are using Codestral, you probably want a Codestral API key, but if you are sharing the key as a team or otherwise want to use `api.mistral.ai`, then make sure to set `"apiBase": "https://api.mistral.ai/v1"` in your `tabAutocompleteModel`.
:::

## Local, offline / self-hosted experience

For those preferring local execution or self-hosting,`StarCoder2-3b` offers a good balance of performance and quality for most users:

```json title="config.json""
{
  "tabAutocompleteModel": {
    "title": "StarCoder2-3b",
    "model": "starcoder2:3b",
    "provider": "ollama"
  }
}
```

## Alternative experiences

- Completions too slow? Try `deepseek-coder:1.3b-base` for quicker completions on less powerful hardware
- Have more compute? Use `deepseek-coder:6.7b-base` for potentially higher-quality suggestions

:::note

For LM Studio users, navigate to the "My Models" section, find your desired model, and copy the path (e.g., second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf). Use this path as the `model` value in your configuration.

:::

## Other experiences

There are many more models and providers you can use with Autocomplete. Check them out [here](../../customize/model-types/autocomplete.md).