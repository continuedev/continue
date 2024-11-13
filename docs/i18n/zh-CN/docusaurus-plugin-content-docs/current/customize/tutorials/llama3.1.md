---
title: Continue 使用 Llama 3.1
description: Continue 如何使用 Llama 3.1
keywords: [llama, meta, togetherai, ollama, replicate]
---

Continue 让使用最新的开元模型编码变得简单，包括整个 Llama 3.1 家族模型。

如果你还没有安装 Continue ，你可以安装 [VS Code 在这里](https://marketplace.visualstudio.com/items?itemName=Continue.continue) 或者 [JetBrains 在这里](https://plugins.jetbrains.com/plugin/22707-continue) 。对于更通用的定制 Continue 的信息，查看 [我们的定制文档](../overview.md) 。

下面，我们分享一些最简单的配置和运行，基于你的使用情况。

## Ollama

Ollama 是最快的配置和运行本地语言模型的方法。我们推荐尝试 Llama 3.1 8b ，它是令人印象深刻的，它的大小和在大多数硬件上表现良好。

1. 下载 Ollama [在这里](https://ollama.ai/) （它将带你通过其他的步骤）
2. 打开终端并运行 `ollama run llama3.1:8b`
3. 修改 Continue 配置文件像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 8b",
      "provider": "ollama",
      "model": "llama3.1-8b"
    }
  ]
}
```

## Groq

Groq 提供最快的可用的开源语言模型推理，包括整个 Llama 3.1 家族。

1. 获取 API key [在这里](https://console.groq.com/keys)
2. 更新你的 Continue 配置文件像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "groq",
      "model": "llama3.1-405b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

## Together AI

Together AI 提供开源模型的快速和可信任的推理。你可以以良好的速度运行 405b 模型。

1. 创建账号 [在这里](https://api.together.xyz/signup)
2. 复制出现在欢迎屏幕上你的 API key
3. 更新你的 Continue 配置文件像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "together",
      "model": "llama3.1-405b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

## Replicate

Replicate 让使用 API 托管和运行开源 AI 变得简单。

1. 获取你的 Replicate API key [在这里](https://replicate.ai/)
2. 修改你的 Continue 配置文件像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Llama 3.1 405b",
      "provider": "replicate",
      "model": "llama3.1-405b",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

## SambaNova

SambaNova Cloud 提供 Llama3.1 70B/405B 服务的世界记录。

1. 创建账号 [在这里](https://cloud.sambanova.ai/)
2. 复制你的 API key
3. 更新你的 Continue 配置文件像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "SambaNova Llama 3.1 405B",
      "provider": "sambanova",
      "model": "llama3.1-405b",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```
