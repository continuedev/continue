# Azure OpenAI

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant.

:::info[Getting access]
You need to apply for access to the Azure OpenAI service. Response times are typically within a few days.

**[Click here to apply for access to the Azure OpenAI service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)**
:::

## Configuration

You can configure Azure OpenAI service through the UI, or you can configure it manually in `config.json`.

```json title="~/.continue/config.json"
"models": [{
    "title": "Azure OpenAI",
    "provider": "azure",
    "model": "<YOUR_MODEL>",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}]
```
