# TogetherLLM

The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Together CodeLlama",
      "provider": "together",
      "model": "codellama-13b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Together.ts)
