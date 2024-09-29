# Kindo

Kindo offers centralized control over your organization's AI operations, ensuring data protection and compliance with internal policies while supporting various commercial and open-source models. To get started, sign up [here](https://app.kindo.ai/), create your API key on the [API keys page](https://app.kindo.ai/settings/api), and choose a model from the list of supported models in the [plugins tab](https://app.kindo.ai/plugins).

## Config Example

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "kindo",
      "model": "claude-3-5-sonnet-20240620",
      "apiKey": "<KINDO_API_KEY>"
    }
  ]
}
```

## Tab Autocomplete Config Example

```json title="config.json"
{
  "tabAutocompleteModel": [
    {
      "title": "WhiteRabbitNeo",
      "provider": "kindo",
      "model": "/models/WhiteRabbitNeo-33B-DeepSeekCoder",
      "apiKey": "<KINDO_API_KEY>"
    },
    {
      "title": "DeepSeek",
      "provider": "kindo",
      "model": "deepseek-ai/deepseek-coder-33b-instruct",
      "apiKey": "<KINDO_API_KEY>"
    }
  ]
}
```

## Security

To update your organization's model access, adjust the controls in [security settings](https://app.kindo.ai/security-settings).
