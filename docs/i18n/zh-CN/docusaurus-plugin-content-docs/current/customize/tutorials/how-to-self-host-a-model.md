---
title: 如何自托管模型
---

你可以在你的 [AWS](https://github.com/continuedev/deploy-os-code-llm#aws), [GCP](https://github.com/continuedev/deploy-os-code-llm#gcp), [Azure](https://github.com/continuedev/deploy-os-code-llm#azure), [Lambda](https://lambdalabs.com/) 或 [其他云](https://github.com/continuedev/deploy-os-code-llm#others-2) 上部署模型，使用：

- [HuggingFace TGI](https://github.com/continuedev/deploy-os-code-llm#tgi)
- [vLLM](https://github.com/continuedev/deploy-os-code-llm#vllm)
- [SkyPilot](https://github.com/continuedev/deploy-os-code-llm#skypilot)
- [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints) (OpenAI 兼容 API)
- [Lambda](https://github.com/continuedev/deploy-os-code-llm#lambda)

## 自托管开源模型

对于很多情况， Continue 内置的提供者或你使用的 API 是 OpenAI-兼容的，这种情况下，你可以使用 "openai" 提供者，修改 "baseUrl" 指向服务器。

不过，如果这些情况都不是，你需要编写一个新的 LLM 对象。

## 认证

对于任何提供者，基本认证可以通过使用 `apiKey` 字段完成：

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

这会转换为 header `"Authorization": "Bearer xxx"` 。

如果你需要发送定制的 header 来认证，你可能使用 `requestOptions.headers` 属性，比如这里例子中的 Ollama ：

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

类似地，如果你的模型需要 Certificate 来认证，你可能使用 `requestOptions.clientCertificate` 属性，比如下面的例子：

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
