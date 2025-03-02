---
title: secret 类型
description: secret 类型介绍
keywords: [secret, 类型]
sidebar_label: 类型
---

# secret 类型

Continue Hub 内置 secret 管理。 secret 是一个值，比如 API key 或 端点，可以通过助手在组织中分享。

## 用户 secret

用户 secret 是由用户给自己定义的。这意味着用户 secret 只对创建它们的用户可用。用户 secret 假设对用户知道是安全的，所以它们会发送到 IDE 扩展，与助手 `config.yaml` 一起。

这允许 API 请求直接从 IDE 扩展创建。你可以使用用户 secret ，在 [个人](../governance/pricing.md#solo), [团队](../governance/pricing.md#teams) 和 [企业](../governance/pricing.md#enterprise) 。用户 secret 可以在 hub 中 [在这里](https://hub.continue.dev/settings/secrets) 管理。

## 组织 secret

组织 secret 是由它们的组织管理员定义的。组织 secret 对组织中的任何人可用，在这个组织中使用助手。组织假设不会分享给用户 (比如，你是一个团队 leader ，想要给团队成员访问模型，而不需要发送 API key) 。 

这就是为什么 LLM 请求通过 api.continue.dev / 预置的代理， secret 永远不会发送到 IDE 扩展。你智能使用 secret 在 [团队](../governance/pricing.md#teams) 和 [企业](../governance/pricing.md#enterprise) 。如果你是一个管理员，你可以在组织设置页面为你的组织管理 secret 。
