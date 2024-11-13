---
title: 免费试用
slug: ../free-trial
---

`"免费试用"` 提供者提供新用户在 Continue 快速尝试最好的体验，通过一个安全的代理服务器使用我们的 API key 。为了避免滥用，我们要求你使用 Github 登录，你可以在下面看到更多。

虽然 Continue 扩展总是免费使用，我们不能为所有用户提供无限免费 LLM 使用。你最终需要：

1. 选择一个开源模型免费使用 [本地的](../top-level/ollama.md), 或者
2. 添加你自己的 [Anthropic](../top-level/anthropic.md) API key 或者 [其他的 LLM 提供者](/customize/model-providers)

## 试用的常见问题

Continue 要求免费试用用户登录，让我们可以避免我们的 API 端点滥用。如果你不使用免费试用，我们不会要求你登录。

### 我如何停止 Continue 询问我登录？

移除 "models" 列表或 "tabAutocompleteModel" 中 `"provider": "free-trial"` 的所有模型，我们将不会再请求登录。

### 什么信息被收集？

Continue 使用你的 GitHub 用户名，没有其他信息，唯一的目的是限制请求。

### 如果我没有登录，会发生什么？

如果你没有登录，你仍然可以使用 Continue 的每个特性，你只需要提供自己的 LLM ，不论使用 API key 或运行本地的模型。

### 遥测与登录有什么关系？

它没有。我们没有关联你的 GitHub 用户名到遥测数据。
