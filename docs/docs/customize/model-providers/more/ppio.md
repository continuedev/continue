# PPIO

[PPIO](https://ppinfra.com?utm_source=github_continuedev) supports stable and cost-efficient open-source LLM APIs, such as DeepSeek, Llama, Qwen etc. Try the [PPIO Llama 3 API Demo](https://ppinfra.com/llm?utm_source=github_continuedev) today!. You can sign up [here](https://ppinfra.com/user/login?utm_source=github_continuedev), copy your API key on the [Key Management](https://ppinfra.com/settings/key-management?utm_source=github_continuedev), and then hit the play button on any model from the [PPIO Models list](https://ppinfra.com/llm-api?utm_source=github_continuedev). Change `~/.continue/config.json` to look like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 8B",
      "provider": "ppio",
      "model": "meta-llama/llama-3.1-8b-instruct",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/PPIO.ts)
