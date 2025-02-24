---
title: 概览
description: 定制 Continue 简介
keywords: [定制, 配置, 配置]
---

Continue 可以深度定制。这个主要通过编辑位于 `~/.continue/config.json` (MacOS / Linux) 或 `%USERPROFILE%\.continue\config.json` (Windows) 的本地文件实现。 `config.json` 在你第一次使用 Continue 时创建。

## 开始

要打开 `config.json` ，在 Continue 聊天侧边栏的右下角点击 "齿轮" 图标。当编辑这个文件时，你可以使用 IntelliSense ，随着你的输入来查看有效的选项，或者你可以查看 [完整参考](../reference.md) 。

当你保存 `config.json` 时， Continue 会自动地刷新，应用你的变更。

## 每个工作区的配置

如果你想要限制指定的配置到一个特定的工作区，你可以添加一个 `.continuerc.json` 到你的项目根目录。它有和 `config.json` 相同的 [定义](../reference.md) ，会自动地应用到本地 `config.json` 之上。

## 可编程的配置

`config.json` 可以处理大多数需要的配置，所以我们推荐在可能的情况下使用它。不过，如果你需要可编程的配置 Continue ，你可以使用 `config.ts` ，它位于 `~/.continue/config.ts` (MacOS / Linux) 或 `%USERPROFILE%\.continue\config.ts` (Windows) 。

例如，如何使用 `config.ts` ，查看 [编写定制斜杠命令](./tutorials/build-your-own-slash-command.md#自定义斜杠命令) 或者 [编写定制上下文提供者](./tutorials/build-your-own-context-provider.md) 。
