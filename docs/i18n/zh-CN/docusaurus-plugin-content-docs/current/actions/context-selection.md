---
title: 上下文选择
description: Actions \-上下文选择
keywords: [上下文, 斜杠, 调试, 快速修复, 右击]
sidebar_position: 3
---

## 斜杠命令

斜杠命令可以与更多的指令结合，包括 [上下文提供者](../customize/context-providers.mdx) 或 [高亮代码](../edit/context-selection#高亮代码) 。

## 快速 action

快速 action 总是显示在一个类和函数上，将会编辑那个类或函数，但是不会对外面的东西有影响。

## 右击 action

你选择的高亮代码将会包含在你的提示词中，和一些基于选择的 action 提前写好的指令一起。这是模型想要尝试的仅有的代码块。

## 调试 action

调试 action 选择最近运行的终端命令以及它的输出，然后插入以下提示词到聊天窗口中。没有更多的，不可见的信息发送给语言模型。

```
I got the following error, can you please help explain how to fix it?

[ERROR_MESSAGE]
```

## 快速修复

类似于调试 action ，快速 action 透明地添加提示词到聊天窗口中。当你选择 "Ask Continue" ，错误的上下 3 行会发送给聊天，跟上问题 "How do I fix the following problem in the above code?: [ERROR_MESSAGE]" 。
