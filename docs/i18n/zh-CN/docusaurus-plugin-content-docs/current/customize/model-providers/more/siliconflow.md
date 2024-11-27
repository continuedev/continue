---
title: 硅基流动
---

:::info

你可以从 [Silicon Cloud](https://cloud.siliconflow.cn/account/ak) 获取 API key 。

:::

## 聊天模型

我们推荐配置 **Qwen/Qwen2.5-Coder-32B-Instruct** 作为你的聊天模型。

```json title="config.json"
{
  "models": [
    {
      "title": "Qwen",
      "provider": "siliconflow",
      "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
      "apiKey": "[API_KEY]"
    }
  ]
}
```

## 自动补全模型

我们推荐配置 **Qwen/Qwen2.5-Coder-7B-Instruct** 作为你的自动补全模型。

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Qwen",
    "provider": "siliconflow",
    "model": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "apiKey": "[API_KEY]"
  }
}
```

## 嵌入模型

SiliconFlow 提供了一些嵌入模型，[点击这里](https://siliconflow.cn/models) 查看所有的嵌入模型.

## 重排序模型

SiliconFlow 提供了一些重排序模型，[点击这里](https://siliconflow.cn/models) 查看所有的重排序模型.

[Click here](https://siliconflow.cn/models) to see a list of reranking models.
