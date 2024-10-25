---
title: How to self-host a model
---

You can deploy a model in your [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), [Lambda](https://lambdalabs.com/), or [other clouds](https://github.com/continuedev/deploy-os-code-llm#others-2) using:

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI compatible API)
- [Lambda](https://github.com/continuedev/deploy-os-code-llm#lambda)

## Self-hosting an open-source model

For many cases, either Continue will have a built-in provider or the API you use will be OpenAI-compatible, in which case you can use the "openai" provider and change the "baseUrl" to point to the server.

However, if neither of these are the case, you will need to wire up a new LLM object.

## Authentication

Basic authentication can be done with any provider using the `apiKey` field:

```json title="config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "apiKey": "xxx"
    }
  ]
}
```

This translates to the header `"Authorization": "Bearer xxx"`.

If you need to send custom headers for authentication, you may use the `requestOptions.headers` property like in this example with Ollama:

```json title="config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "requestOptions": {
        "headers": {
          "X-Auth-Token": "xxx"
        }
      }
    }
  ]
}
```

Similarly if your model requires a Certificate for authentication, you may use the `requestOptions.clientCertificate` property like in the example below:

```json title="config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "requestOptions": {
        "clientCertificate": {
          "cert": "C:\tempollama.pem",
          "key": "C:\tempollama.key",
          "passphrase": "c0nt!nu3"
        }
      }
    }
  ]
}
```
