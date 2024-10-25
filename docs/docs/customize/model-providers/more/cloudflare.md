# Cloudflare Workers AI

Cloudflare Workers AI can be used for both chat and tab autocompletion in Continue. To setup Cloudflare Workers AI, add the following to your `config.json` file:

```json title="config.json"
{
  "models": [
    {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "contextLength": 2400,
      "completionOptions": {
        "maxTokens": 500
      },
      "model": "@cf/meta/llama-3-8b-instruct", // This can be the name of any model supported by Workers AI
      "provider": "cloudflare",
      "title": "Llama 3 8B"
    },
    {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "contextLength": 2400,
      "completionOptions": {
        "maxTokens": 500
      },
      "model": "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
      "provider": "cloudflare",
      "title": "DeepSeek Coder 6.7b Instruct"
    }
    ...
    "tabAutocompleteModel": {
      "accountId": "YOUR CLOUDFLARE ACCOUNT ID",
      "apiKey": "YOUR CLOUDFLARE API KEY",
      "model": "@hf/thebloke/deepseek-coder-6.7b-base-awq",
      "provider": "cloudflare",
      "title": "DeepSeek 7b"
    },
  ]
}
```

Visit the [Cloudflare dashboard](https://dash.cloudflare.com/) to [create an API key](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

Review [available models](https://developers.cloudflare.com/workers-ai/models/) on Workers AI

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Cloudflare.ts)
