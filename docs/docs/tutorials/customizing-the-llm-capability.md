# Customizing the LLM capability

Sometimes when you use certain third-party interface providers, such as [one api](https://github.com/songquanpeng/one-api), [openRouter](https://openrouter.ai/), etc., they offer openai-compatible interfaces, but the model names are highly different.

Continue cannot determine the capabilities of the model, whether it supports uploading images or files, etc. You can clearly inform Continue about the capabilities of the model.

```typescript title="~/.continue/config.json"
{
  "models": [
    {
      "title": "kimi",
      "provider": "openai",
      "model": "moonshot-kimi",
      "contextLength": 8192,
      "apiBase": "https://any-your-thrid-part-OpenAI-compatible-api-provider/v1",
      "capabilities": {
        "uploadImage": true
      }
    }
  ]
}
```
