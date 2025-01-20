# GeekAI

GeekAI is a unified interface for commercial and open-source models, giving you access to the best models at the lower prices than offically. You can sign up [here](https://geekai.dev/login), create your API key on the [keys page](https://geekai.dev/user/api_keys), and then choose a model from the [list of supported models](https://geekai.dev/models).

Change `~/.continue/config.json` to look like the following.

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "geekai",
      "model": "claude-3-5-sonnet-latest",
      "apiBase": "https://geekai.dev/api/v1",
      "apiKey": "..."
    }
  ]
}
```

Learn more about available settings [here](https://geekai.dev/docs/api).
