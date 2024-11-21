---
title: 它是如何工作的
description: actions 是如何工作的
keywords: [如何, 斜杠, 命令, 提示词, 右击, 快速修复, 调试, action]
sidebar_position: 4
---

很多 action 基于模板提示词，可以使用 .prompt 文件配置，在底层有一些执行更复杂的代码。

action 生成行内 diff ，比如 "/edit", "/comment" 或右击 action ，使用与 [编辑](edit/how-it-works.md) 相同的提示词和响应处理逻辑。

要了解其他斜杠命令如何工作的， [在这里](../customize/slash-commands.md) 查看完整参考。
