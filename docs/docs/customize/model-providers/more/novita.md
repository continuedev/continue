# Novita

The Novita API is a cloud platform for running large AI models. You can sign up [here](https://novita.ai/user/login?&redirect=/&utm_source=github_continuedev), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Novita Models list](https://novita.ai/llm-api?utm_source=github_continuedev&utm_medium=github_readme&utm_campaign=link). Change `~/.continue/config.json` to look like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Novita Qwen2.5 Coder",
      "provider": "novita",
      "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Novita.ts)
