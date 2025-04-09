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

最常见的调用 action 的方法是使用斜杠命令。通过输入 '/' 并在下拉框中选择，这里有快捷方式会被激活。例如，内置的 '/edit' 斜杠命令，让你可以直接在你的编辑器中流式地编辑。

![slash-commands](/img/slash-commands.png)

一些最常用的斜杠命令默认是可用的，比如 "/edit", "/comment" 和 "/share" ，但是 Continue 有大量内置的其他选择的库。要启用它们，[在这里](../customize/slash-commands.md) 了解更多。

### prompt 文件

通过定义一个 ".prompt 文件" ，也可以编写你自己的斜杠命令。 prompt 文件可以是个简单的文本文件，但是也包含模板，所以你可以引用文件， URL ，高亮代码以及更多。

完整的 .prompt 文件可以参考 [这里](../customize/deep-dives/prompt.md) 。

:::tip[Prompt 库]
为了帮助你开始，[我们精心编写了一个小的 `.prompt` 文件库](https://github.com/continuedev/prompt-file-examples) 。我们鼓励社区贡献到这个仓库，所以请考虑为你的 prompt 创建一个拉取请求！
:::

以下是一个快速示例，设置一个使用 Jest 编写单元测试的 prompt 文件。

1. 在你的工作区的最高层级，创建一个名为 `.prompts/` 的目录。
2. 在这个目录中，添加一个名为 `test.prompt` 的文件。这个文件的名称将是你用来生成提示词的斜杠命令的名称。
3. 写入以下内容到 `test.prompt` 并保存。

```
{{{ input }}}

Write unit tests for the above selected code, following each of these instructions:
- Use `jest`
- Properly set up and tear down
- Include important edge cases
- The tests should be complete and sophisticated
- Give the tests just as chat output, don't edit any file
- Don't explain how to set up `jest`
```

现在要使用这个提示词，你可以高亮代码，并使用 `cmd/ctrl+L` 来选择它到 Continue 侧边栏中。

然后，输入 "/" 来查看斜杠命令列表，选择名为 "test" 的那个。按下回车， LLM 会响应你的 prompt 文件中给出的指令。

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

调试 action 是 VS Code 扩展中一个特殊的内置键盘快捷方式。使用 `cmd/ctrl+shift+R` 来快速复制当前终端的内容到聊天侧边栏，并获得调试建议。

#### 快速修复

无论何时在你的代码中看到红色/黄色下划线表示错误，你可以把光标放到附近， VS Code 会显示一个灯泡图标。无论点击灯泡，或使用 `cmd/ctrl+.` 快捷键，将会显示一个快速修复的下拉菜单。其中之一是 "Ask Continue" action 。无论单击或再次使用 `cmd/ctrl+.` ， Continue 将尝试帮助解决问题。

![ask-continue](/img/ask-continue.png)
