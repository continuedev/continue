---
title: 上下文选择
description: 如何为聊天选择上下文
keywords: [上下文]
sidebar_position: 3
---

## 输入

输入一个问题或指令到输入框中是仅有的必须的上下文。所有列在下面选择和包含更多上下文的其他方法都是可选的。

## 高亮代码

你通过按下 `cmd/ctrl + L` (VS Code) 或 `cmd/ctrl + J` (JetBrains) 选择的高亮代码，将包含在你的提示词中，和你提供的输入一起。这是提供给模型的仅有的代码片段，除非你高亮更多的片段，或使用以下的选择方法之一。

## 活动文件

在发送请求时，你可以通过按下 `cmd/ctrl + opt + enter` 包含当前打开的文件作为上下文。

## 指定文件

你可以通过输入 [`@Files`](../customize/context-providers.md#files) 并选择文件，包含当前工作区中的指定文件作为上下文。

## 指定目录

你可以通过输入 [`@Folder`](../customize/context-providers.md#folders) 并选择目录，包含当前工作区中指定目录作为上下文。它像 [`@Codebase`](../customize/deep-dives/codebase.md) 一样工作，但是只包含指定目录中的文件。

## 整个代码库

你可以通过输入 [`@Codebase`](../customize/context-providers.md#codebase-retrieval) 包含整个代码库作为上下文。你可以 [在这里](../customize/deep-dives/codebase.md) 了解 `@Codebase` 是如何工作的。

## 文档网址

你可以通过输入 [`@Docs`](../customize/context-providers.md#documentation) 并选择文档网址，包含文档网址作文上下文。你可以 [在这里](../customize/deep-dives/docs.md) 了解 `@Docs` 是如何工作的。

## 终端内容

你可以通过输入 [`@Terminal`](../customize/context-providers.md#terminal) ，包含 IDE 中终端的内容作为上下文。

## Git diff

你可以通过输入 [`@Git Diff`](../customize/context-providers.md#git-diff) ，包含当前分支中你做的所有变更作为上下文。

## 其他上下文

你可以 [在这里](../customize/context-providers.md) 看到完整的内置上下文提供者列表，以及 [在这里](../customize/tutorials/build-your-own-context-provider.md) 看到如何创建你自己定制的上下文提供者。
