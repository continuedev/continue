# Cerebras

Cerebras is one of the fastest inference providers right now, with Llama 3.1 8B inference running at 2000+ tokens/second

1. Obtain an API key [here](https://cloud.cerebras.ai)
   - Note: You have to be verified on their waitlist
2. Update your Continue config file like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 70b",
      "provider": "cerebras",
      "model": "llama3.1-70b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```
