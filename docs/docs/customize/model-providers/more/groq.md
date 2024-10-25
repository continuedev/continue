# Groq

Groq provides the fastest available inference for open-source language models, including the entire Llama 3.1 family.

1. Obtain an API key [here](https://console.groq.com/keys)
2. Update your Continue config file like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "groq",
      "model": "llama3.1-405b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```
