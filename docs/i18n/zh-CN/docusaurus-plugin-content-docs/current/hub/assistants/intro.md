---
title: 助手介绍
sidebar_label: 介绍
description: 助手功能概览
keywords: [助手, 概览, 定制]
---

# 助手介绍

定制 AI 代码助手通过构建 [blocks](../blocks/intro.md) 来配置，允许编码体验裁剪为你指定的使用情况。

`config.yaml` 是一个定制代码助手的格式。一个助手有一些最高级别的属性 (例如， `name`, `version`) ，但是除此以外还包含 **块** （比如 `models` 和 `rules`）的列表的组合，它们是组成助手的原子构建块。

`config.yaml` 由开源的 Continue IDE 扩展解析，创建定制的助手体验。当你登录到 [hub.continue.dev](https://hub.continue.dev/) ，你的助手会自动地同步到 IDE 扩展。
