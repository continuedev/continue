---
title: 块类型
description: 不同块类型概览
keywords: [块, 类型, 概览]
sidebar_label: Types
---

# 块类型

## 模型

模型是一个块，让你指定大语言模型（LLM）和其他深度学习模型，用在开源 IDE 扩展的不同角色，比如聊天、自动补全、编辑、嵌入、重排序等等。你可以在 [hub](https://hub.continue.dev/explore/models) 上查看可用的模型。

Continue 支持 [很多模型提供者](../../customize/model-providers) ，包括 Anthropic, OpenAI, Gemini, Ollama, Amazon Bedrock, Azure, xAI, DeepSeek 以及更多。模型可以有一个或多个以下角色，基于它的能力，包括 `chat`, `edit`, `apply`, `autocomplete`, `embed` 和 `rerank` 。查看更多关于角色 [在这里](../../customize/model-roles) 。查看 [`models`](../../yaml-reference.md#models) 在 YAML 参考中获取更多详情。

## 上下文

Context 块定义一个上下文提供者，可以在聊天中用 `@` 引用，拉取外部来源的数据，比如文件和目录， URL ， Jira 或 Confluence ，以及 Github issue ，还有其他。在 hub 上 [查看上下文提供者块](https://hub.continue.dev/explore/context) 。

查看更多关于上下文提供者 [在这里](../../yaml-reference.md#context) ，检查 [这个指南](../../customize/tutorials/build-your-own-context-provider.mdx) 创建你自己的定制上下文提供者。 `config.yaml` 中的上下文规范可以在 [`这里`](../../yaml-reference.md#context) 找到。

## 文档

文档是一个指向文档站点的块，将会在本地索引，然后在聊天中使用 `@Docs` 作为上下文引用。在 hub 中 [查看文档](https://hub.continue.dev/explore/docs) 。

了解更多，在 [深入理解 `@Docs`](../../customize/deep-dives/docs.mdx) ，查看 YAML 参考中的 [`docs`](../../yaml-reference.md#docs) 获取更多详情。

## MCP 服务器

模型上下文协议 (MCP) 是一个标准的方法，用来构建和分享语言模型的工具。 MCP 服务器可以在 `mcpServers` 块中定义。在 hub 中 [查看 MCP 服务器](https://hub.continue.dev/explore/mcp) 。

了解更多，在 [深入理解工具](../../customize/tools.mdx) 中，查看 YAML 参考中的 [`mcpServers`](../../yaml-reference.md#mcpservers) 获取更多详情。

## Rules

Rules 块是你的定制 AI 代码助手一直记住的指令 - rule 的内容会被插入到所有聊天请求的系统信息中。在 hub 中 [查看 rules](https://hub.continue.dev/explore/rules) 。

了解更多，在 [深入理解 rules ](../../customize/deep-dives/rules.md) 中，查看 YAML 参考中的 [`rules`](../../yaml-reference.md#rules) 获取更多详情。

## 提示词

提示词块是预先编写，可重复使用的提示词，可以在聊天的任何时间引用。它们作为上下文在重复的和复杂的任务中特别有用。在 hub 中[查看提示词](https://hub.continue.dev/explore/prompts) 。

提示词块有着和 [prompt files](../../customize/deep-dives/prompt-files.md) 一样的语法。提示词块和提示词文件有两个重要的不同点：

1. 提示词块保存在 `config.yaml` 中，而 `.continue/prompts` 在项目目录
2. 提示词块只显示为聊天中的斜杠命令，不在 `@Prompt Files` 上下文提供者中显示

`config.yaml` 中 `prompts` 规范可以在 [这里](../../yaml-reference.md#prompts) 找到。

## 数据

数据块允许你发送开发数据到你选择的定制目标上。开发数据可以用在不同的目的上，包括分析使用，收集亮点，或者微调模型。你可以查看更多关于开发数据 [在这里](../../customize/deep-dives/development-data.md) 。查看数据块示例 [在这里](https://hub.continue.dev/explore/data) 。

数据目标在 `config.yaml` 中 [`data`](../../yaml-reference.md#data) 小节配置。
