---
title: Azure AI Foundry
slug: ../azure
---

Azure AI Foundry is a cloud-based service that provides access to models from OpenAI, Mistral AI, and others, integrated with the security and enterprise features of the Microsoft Azure platform. To get started, create an Azure AI Foundry resource in the [Azure portal](https://portal.azure.com).

:::info

For details on OpenAI model setup, see [Azure OpenAI Service configuration](#general-model-configuration).

:::

## Chat model

We recommend configuring **GPT-4o** as your chat model.

```json title="config.json"
"models": [{
    "title": "GPT-4o",
    "provider": "azure",
    "model": "gpt-4o",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "deployment": "<YOUR_DEPLOYMENT_NAME>",
    "apiKey": "<MY_API_KEY>" // If you use subscription key, try using Azure gateway to rename it apiKey
}]
```

## Autocomplete model

We recommend configuring **Codestral** as your autocomplete model.

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest"
  }
}
```

## Embeddings model

We recommend configuring **text-embedding-3-large** as your embeddings model.

```json title="config.json"
"embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<YOUR_DEPLOYMENT_BASE>",
    "deployment": "<YOUR_DEPLOYMENT_NAME>",
    "apiType": "azure",
    "apiKey": "<MY_API_KEY>"
}
```

## Reranking model

Azure OpenAI currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking models.

## Privacy

If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant.

:::info[Getting access]
You need to apply for access to the Azure OpenAI service. Response times are typically within a few days.

**[Click here to apply for access to the Azure OpenAI service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)**
:::

## Azure OpenAI Service configuration

Azure OpenAI Service requires a handful of additional parameters to be configured, such as a deployment name and API base URL.

To find this information in _Azure AI Foundry_, first select the model that you would like to connect. Then visit _Endpoint_ > _Target URI_.

For example, a Target URI of `https://just-an-example.openai.azure.com/openai/deployments/gpt-4o-july/chat/completions?api-version=2023-03-15-preview` would map to the following:

```json
{
  "title": "GPT-4o Azure",
  "model": "gpt-4o",
  "provider": "openai",
  "apiBase": "https://just-an-example.openai.azure.com",
  "deployment": "gpt-4o-july",
  "apiVersion": "2023-03-15-preview",
  "apiKey": "<MY_API_KEY>"
}
```
