# Groq

:::info

Check if your chosen model is still supported by referring to the [model documentation](https://console.groq.com/docs/models). If a model has been deprecated, you may encounter a 404 error when attempting to use it.

:::

Groq provides the fastest available inference for open-source language models, including the entire Llama 3.1 family.

1. Obtain an API key [here](https://console.groq.com/keys)
2. Update your Continue config file like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.3 70b Versatile",
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "apiKey": "<API_KEY>"
    }
  ]
}
```
