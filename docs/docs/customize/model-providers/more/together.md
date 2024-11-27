# Together

The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/serverless-models). Change `~/.continue/config.json` to look like this:

```json title="config.json"
{
  "models": [
    {
      "title": "Together Qwen2.5 Coder",
      "provider": "together",
      "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Together.ts)
