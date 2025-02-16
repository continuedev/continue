---
title: 编辑
sidebar_position: 1
sidebar_label: 如何使用它
description: 如何使用编辑
keywords: [编辑, cmd l, 使用]
---

![edit](/img/edit.gif)

## 如何使用它

编辑是一种不用离开你的当前文件来修改代码的方便的方式。高亮一个代码块，描述你的代码变更，一个 diff 会流式地出现在你的文件行内，你可以接受或拒绝。

编辑最好用在小的，快速的变更上，比如：

- 编写注释
- 生成单元测试
- 重构函数或方法

## 高亮代码并激活

高亮你想要修改的代码块，按下 <kbd>cmd/ctrl</kbd> + <kbd>i</kbd> 来激活编辑输入。

## 描述代码变更

描述你想要模型对你的高亮代码所做的变更。对于编辑，一个好的提示词应该是相对较短且简洁的。对于长的，更复杂的任务，我们推荐使用 [聊天](../chat/how-to-use-it.md) 。

## 接受和拒绝变更

建议的变更作为行内 diff 出现在你的高亮文本中。

你可以导航到每个建议变更，接受或拒绝它们，使用 <kbd>cmd/ctrl</kbd> + <kbd>opt</kbd> + <kbd>y</kbd> (接受) 或 <kbd>cmd/ctrl</kbd> + <kbd>opt</kbd> + <kbd>n</kbd> (拒绝) 。

你也可以一次性接受或拒绝所有变更，使用 <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>enter</kbd> (接受) 或 <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>delete</kbd> (拒绝) 。

如果你想要对于相同的高亮代码块请求一个新的建议，你可以使用 <kbd>cmd/ctrl</kbd> + <kbd>i</kbd> 重新提示模型。
