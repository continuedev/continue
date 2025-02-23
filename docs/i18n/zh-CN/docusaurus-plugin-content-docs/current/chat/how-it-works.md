---
title: 它是如何工作的
description: 聊天是如何工作的
keywords: [如何, 聊天, 工作]
sidebar_position: 4
---

使用任何选择的代码片段，你使用 @ 选择的所有上下文，以及你的输入指令，在侧边栏中，我们将提示词给模型，让它提供一个响应。如果你询问跟进的问题，那么所有前面的会话上下文也会被包含。没有其他更多的上下文提供给模型。

模型的响应会直接流式地返回到侧边栏。每个响应中的代码片段将放在它自己的代码块中，每个代码块会给你一些按钮，“应用到当前文件”， “插入到光标处” 或 “复制” 。当你在会话的结尾按下 `cmd/ctrl + L` (VS Code) 或 `cmd/ctrl + J` (JetBrains) ，所有上下文会被清除，一个新的会话将会开始，让你可以开始一个新的任务。

如果你想查看聊天中发送给模型的确切的提示词，你可以 [在提示词日志中查看这个](../troubleshooting.md#llm-提示词日志) 。

You can learn more about how `@Codebase` works [here](../customize/deep-dives/codebase.md) and `@Docs` [here](../customize/deep-dives/docs.md).

你可以 [在这里](../customize/deep-dives/codebase.md) 了解 `@Codebase` 是如何工作的， 以及 [在这里](../customize/deep-dives/docs.md) 了解 `@Docs` 。
