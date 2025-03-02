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


In YAML assistants, slash commands are generated from [`prompts` blocks](../hub/blocks/block-types.md#prompts).

Learn more about slash commands [here](../customize/slash-commands.mdx).

:::info
Important: For assistants, slash commands only come from `prompts` blocks. When using older `config.json` configuration, other slash commands like `/share` and `/cmd` are included by default.
:::

### Prompt files

It is also possible to write your own slash command by defining a “.prompt file.” Prompt files can be as simple as a text file, but also include templating so that you can refer to files, URLs, highlighted code, and more.

Learn more about prompt files [here](../customize/deep-dives/prompt-files.md)

### Other triggers for Actions (VS Code)

:::info
Currently all of these are only available in VS Code
:::

To make common use cases even more accessible, we provide a handful of other ways to invoke actions.

#### Quick actions

Quick Actions are displayed as buttons above top-level classes and functions in your source code, letting you invoke actions with one click. They can also be customized with .prompt files to perform custom actions.

![quick-actions](/img/quick-actions.png)

By default, quick actions are disabled, but can be enabled with the “Continue: Enable Quick Actions” in VS Code settings.

#### Right click actions

Right click actions let you highlight a desired region of code, right click, and then select an action from the dropdown menu.

![context-menu](/img/context-menu.png)

#### Debug action

The debug action is a special built-in keyboard shortcut in the VS Code extension. Use <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>R</kbd> to instantly copy the contents of the current terminal into the chat sidebar and get debugging advice.

#### Quick fixes

Whenever you see red/yellow underlines in your code indicating errors, you can place your cursor nearby and VS Code will display a lightbulb icon. Either clicking the lightbulb or using the keyboard shortcut <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> will show a dropdown menu of quick fixes. One of these will be the “Ask Continue” action. Either click or use <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> again and Continue will attempt to help solve the problem.

![ask-continue](/img/ask-continue.png)





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
