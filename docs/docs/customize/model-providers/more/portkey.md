# Portkey

Portkey is an AI Gateway that provides LLM request routing, caching, and observability capabilities across multiple AI providers. You can use Portkey to optimize costs, improve reliability, and gain insights into your LLM usage.

1. Create a Portkey account at [app.portkey.ai](https://portkey.sh/continue)
2. Get your API key from the [API Keys page](https://portkey.sh/continue)
3. Add your Portkey Config Slug from Portkey's dashboard
4. Update your Continue config file as follows:

```json title="config.json"
{
  "models": [
    {
      "title": "Autodetect",
      "provider": "portkey",
      "model": "AUTODETECT",
      "apiKey": "YOUR_PORTKEY_API_KEY",
      "portkeyConfigId": "YOUR_PORTKEY_CONFIG_ID"
    }
  ]
}
```

While the Continue configuration shows `"model": "AUTODETECT"`, the actual model selection and routing rules are managed through your Portkey Config. In the Portkey dashboard, you can:
- Set up your preferred AI models
- Configure routing rules
- Define fallback behaviors
- Set up caching and other optimizations

Your `portkeyConfigId` connects Continue to these settings. You can create and manage your configs in the [Portkey dashboard](https://portkey.sh/continue).

Learn more about creating and managing configs in the [Portkey documentation](https://portkey.ai/docs/product/ai-gateway/configs#configs).