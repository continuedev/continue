---
title: 概览
description: 定制 Continue 简介
keywords: [定制, 配置, 配置]
---

Continue 可以被深度定制。例如，你可以：

- **修改你的模型提供者** 。 Continue 允许你选择你最喜欢的或甚至添加多个模型提供者。这允许你对不同的任务使用不同的模型，或者试用其他的模型，如果你不满意当前模型的结果。 Continue 支持所有流行的模型提供者，包括 OpenAI, Anthropic, Microsoft/Azure, Mistral, 以及更多。如果你喜欢，你甚至可以部署自己的模型提供者。了解更多，关于 [模型提供者](/customize/model-providers) 。
- **选择不同的模型提供者，对于每个 Compose 特性** 。不同的 Continue 特性可以使用不同的模型提供者。我们称为 _模型类型_ 。例如，你可以对聊天使用不同的模型提供者，与自动补全不同。了解更多，关于 [模型类型](/customize/model-types) 。
- **添加一个上下文提供者** 。上下文提供者允许你添加信息到你的提示词中，给你的 LLM 工作更多上下文。上下文提供者允许你关联你的代码库的片断，或者查找相关的文档，或者使用搜索引擎查找信息，还有更多。了解更多，关于 [上下文提供者](/customize/context-providers) 。
- **创建一个斜杠命令** 。斜杠命令允许你简单地添加函数式定制到 Continue 中。你可以使用斜杠命令，允许你从自然语言生成 shell 命令，或者可能生成一个 commit 消息，或者创建任何你想要做的自己的定制命令。了解更多，关于 [斜杠命令](/customize/slash-commands) 。
- **调用外部工具或函数** 。解放你的 LLM ，使用 _工具_ 的力量。你可以从你的提示词调用任何外部的工具或函数。当前只有 Anthropic 可用。了解更多，关于 [工具](/customize/tools) 。

无论你选择什么，你可能从编辑 `config.json` 开始。

## 编辑 config.json

大多数定制配置通过编辑 `config.json` 完成。这个文件是一个 JSON 文件，允许你按照喜好定制 Continue 。它可以找到：

- MacOS and Linux: `~/.continue/config.json`
- Windows: `%USERPROFILE%\.continue\config.json`

你可以简单地访问 `config.json` 在 Continue 聊天侧边栏。打开侧边栏，通过按下 <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) 或 <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) ，并点击右下角的 "齿轮" 图标。

![configure-continue](/img/configure-continue.png)

当编辑这个文件时，随着你的输入，你可以看到可用的建议选项，或者你可以查看 [完整参考](./deep-dives/configuration.md) 。

:::info

`config.json` 在你第一次使用  Continue 时创建。如果你想要重置你的配置为默认，你可以删除这个文件， Continue 将会自动使用默认配置重建它。

:::

:::info

当你保存 `config.json` 时， Continue 将会自动刷新，应用你的变更。

:::

## 每个工作区的配置

如果你想要限制特定的设置到一个指定的工作区，你可以添加一个 `.continuerc.json` 到你的项目的根目录。它有和 `config.json` 相同的 [定义](./deep-dives/configuration.md) ，将会自动应用在本地 `config.json` 之上。

## 编程式的配置

`config.json` 可以处理大多数必须的配置，所以我们在可能的情况下推荐使用它。不过，如果你需要编程式的配置 Continue ，你可以使用 `config.ts` ，它位于 `~/.continue/config.ts` (MacOS / Linux) 或 `%USERPROFILE%\.continue\config.ts` (Windows) 。

如何使用 `config.ts` 的示例，查看 [编写定制斜杠命令](./tutorials/build-your-own-slash-command.md#自定义斜杠命令) 或 [编写定制上下文提供者](./tutorials/build-your-own-context-provider.mdx) 。
