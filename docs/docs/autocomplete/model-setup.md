---
title: Model setup
description: Autocomplete \-model setup
keywords: [model, autocomplete]
---

# Model setup

## Best autocomplete experience (Codestral)

For the best autocomplete experience, we recommend using Codestral through the [Mistral API](https://console.mistral.ai/). This model offers high-quality completions with an excellent understanding of code context:

```config.json
{
 "tabAutocompleteModel": {
   "title": "Codestral",
   "provider": "mistral",
   "model": "codestral-latest",
   "apiKey": "YOUR_API_KEY"
 }
}
```

## Self Hosted / Local

For those preferring local execution or self-hosting, StarCoder2-3b offers a good balance of performance and quality for most users:

```config.json
{
 "tabAutocompleteModel": {
     "title": "StarCoder2-3b",
     "model": "starcoder2:3b",
     "provider": "ollama",
 }
}
```

### Alternatives

- Need to be faster? Try deepseek-coder:1.3b-base for quicker completions on less powerful hardware.
- Have more compute? Use deepseek-coder:6.7b-base for potentially higher-quality suggestions.

:::note

For LM Studio users, navigate to the "My Models" section, find your desired model, and copy the path (e.g., second-state/StarCoder2-3B-GGUF/starcoder2-3b-Q8_0.gguf). Use this path in your configuration.

:::

## More

There are many more models and providers you can use with Autocomplete. Check them out [here](../reference/Model%20Providers/).
