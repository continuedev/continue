---
title: Actions
description: 如何使用 Actions
sidebar_label: 如何使用它
keywords: [如何, 斜杠, 命令, 提示词, 右击, 快速修复, 调试, 操作]
sidebar_position: 1
---

![actions](/img/actions.gif)

## 如何使用它

Actions 是常见用例的快捷方式。例如，你可能想要审查代码，编写测试，或添加一个文档字符串。

### 斜杠命令

最常见的调用 action 的方法是使用斜杠命令。通过输入 '/' 可以激活快捷方式，在聊天会话中（按下 <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) 或 <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains)），并在下拉框中选择。

![slash-commands](/img/slash-commands.png)

在 YAML 助手中，斜杠命令由 [`prompts` 块](../hub/blocks/block-types.md#提示词) 生成。

了解更多关于斜杠命令 [在这里](../customize/slash-commands.mdx) 。

:::info
重要：对于助手，斜杠命令只来自 `prompts` 块。当使用旧的 `config.json` 配置，其他斜杠命令，比如 `/share` 和 `/cmd` 默认被包含。
:::

### 提示词文件

编写你自己的斜杠命令也是可能的，通过定义一个 ".prompt file" ，提示词文件就是一个文本文件，但是也包含模板，让你可以引用文件、 URL 、高亮代码以及更多。

了解更多关于提示词文件 [在这里](../customize/deep-dives/prompt-files.md)

### action 的其他触发器 (VS Code)

:::info
目前，所有这些只在 VS Code 中有效
:::

为了让常见用例更可用，我们提供了一些其他方法来触发 action 。

#### 快速 action

快速 action 在你源码中的顶级类和函数上显示为按钮，让你可以一键触发 action 。它们也可以使用 .prompt 文件定制，来执行定制的 action 。

![quick-actions](/img/quick-actions.png)

默认情况下，快速 action 是禁用的，但是可以在 VS Code 的设置中通过 "Continue: Enable Quick Actions" 启用。

#### 右击 action

右击 action 让你高亮期望的代码区域，右击，然后在下拉菜单中选择一个 action 。

![context-menu](/img/context-menu.png)

#### 调试 action

调试 action 是 VS Code 扩展中一个特殊的内置键盘快捷方式。使用 <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>R</kbd> 来快速复制当前终端的内容到聊天侧边栏，并获得调试建议。

#### 快速修复

无论何时在你的代码中看到红色/黄色下划线表示错误，你可以把光标放到附近， VS Code 会显示一个灯泡图标。无论点击灯泡，或使用 <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> 快捷键，将会显示一个快速修复的下拉菜单。其中之一是 "Ask Continue" action 。无论单击或再次使用 <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> ， Continue 将尝试帮助解决问题。

![ask-continue](/img/ask-continue.png)
