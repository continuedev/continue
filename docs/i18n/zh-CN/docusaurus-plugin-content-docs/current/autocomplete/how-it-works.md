---
title: 它是如何工作的
description: 自动补全是如何工作的
keywords: [如何, 自动补全, 上下分]
sidebar_position: 4
---

自动补全是一个 [复合人工智能系统](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/)，使用检索方法和响应处理技术的结合。系统可以大致理解为三个部分。

## 时机

为了快速地显示建议，并且不需要发送太多请求，我们做了下面这些：

- 去抖动: 如果你快速输入，我们不会为每个按键创建一个请求。相反，我们等待直到你完成输入。
- 缓存: 如果你的光标在一个我们已经生成补全的位置，这个补全将会被使用。例如，如果你回退，我们将可以直接显示你之前看到的建议。

## 上下文

就像 [上下文选择](context-selection.md) 页面解释的那样， Continue 使用了大量的检索方法，来查找你的代码库中相关的片断，包含在提示词中。

## 过滤

语言模型不是完美的，但是可以通过调整它们的输出接近完美。在显示建议之前，我们对响应做了大量的后处理，包括:

- 过滤出指定的 token
- 当重新生成代码时，提前停止
- 修复缩进

如果响应是坏的，我们也会偶尔过滤掉整个响应。这通常是因为过度的重复。

You can learn more about how it works in the [Autocomplete deep dive](../customize/deep-dives/autocomplete.md).

你可以在 [深入理解自动补全](../customize/deep-dives/autocomplete.md) 中了解它是如何工作的。
