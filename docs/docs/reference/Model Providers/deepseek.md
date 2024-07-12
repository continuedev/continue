# DeepSeek

To setup DeepSeek, obtain an API key from [here](https://www.deepseek.com/) and add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Deepseek",
      "provider": "deepseek",
      "model": "deepseek-code", // Or any other DeepSeek model
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```
