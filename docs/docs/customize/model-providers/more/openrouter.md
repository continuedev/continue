# OpenRouter

OpenRouter is a unified interface for commercial and open-source models, giving you access to the best models at the best prices. You can sign up [here](https://openrouter.ai/signup), create your API key on the [keys page](https://openrouter.ai/keys), and then choose a model from the [list of supported models](https://openrouter.ai/models).

Change `~/.continue/config.json` to look like the following.

```json title="config.json"
{
  "models": [
    {
      "title": "OpenRouter LLaMA 70 8B",
      "provider": "openrouter",
      "model": "meta-llama/llama-3-70b-instruct",
      "apiBase": "https://openrouter.ai/api/v1",
      "apiKey": "..."
    }
  ]
}
```

To utilize features such as provider preferences or model routing configuration, include these parameters inside the `models[].requestsOptions.extraBodyProperties` field of your plugin config.

For example, to prevent extra long prompts from being compressed, you can explicitly turn off the feature like so:

```json title="config.json"
{
  "models": [
    {
      ...
      "requestOptions": {
        "extraBodyProperties": {
          "transforms": []
        }
      }
    }
  ]
}
```

Learn more about available settings [here](https://openrouter.ai/docs).
