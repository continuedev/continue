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
    "provider": "openai",
    "model": "<YOUR_MODEL>",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "engine": "<YOUR_ENGINE>",
    "apiVersion": "<YOUR_API_VERSION>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}]
```

To find out the information from *Azure AI Studio*, select the model that you would like to connect. Under the *Endpoint* section and capture the Target URI.
For example, Target URI of https://just-an-example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2023-13-15-preview
Maps to:
* model = gpt-4o
* engine = gpt-4o
* apiVersion = 2023-13-15-preview
* apiBase = just-an-example.openai.azure.com
