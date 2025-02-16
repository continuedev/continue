---
title: 提示词文件
---

提示词文件提供一个方便的方式，来标准化通用模式，并与你的团队分享一批 LLM 提示词。它们让构建和使用这些提示词更简单。

## 快速开始

<!-- :::tip[提示词库]
为了帮助你开始，[我们精心编写了一个小的 `.prompt` 文件库](https://github.com/continuedev/prompt-file-examples)。我们鼓励社区贡献到这个仓库，所有请考虑为你的 prompt 创建一个拉取请求！
::: -->

以下是一个快速示例，设置一个 prompt 文件到 de

1. 创建一个名为 `.continue/prompts` 的目录，在你的工作区的最高层级（或者你可以使用 UI 中的按钮，输入 @ ，选择 "Prompt Files" ，选择 "New Prompt File"）。
2. 添加一个名为 `rails.prompt` 的文件到这个目录中。
3. 写入以下内容到 `rails.prompt` 并保存。

```
name: Rails Project
description: Information about this project
---

关联的是当前 Ruby on Rails 应用的总结，包含 @Gemfile 和在 @db/schema.rb 中的数据库 schema
```

现在使用这个提示词，你可以高亮代码，并使用 <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> 来选择它到 Continue 侧边栏中。

然后，输入 "@" ，选择 "Prompt files"，选择名为 "Rails Project" 的那个。你现在可以像往常一样提问， LLM 会有你的 .prompt 文件中的信息。

## 格式

格式来自 [HumanLoops 的 .prompt 文件](https://docs.humanloop.com/docs/prompt-file-format) ，并通过额外的模板，关联文件， URL 和上下文提供者。

:::info
这个格式的当前状态时试验性的，并且可能变更
:::

### preamble

"preamble" 是 `---` 分隔符之上的任何东西，让你可以指定模型参数。它使用 YAML 语法，当前支持以下参数：

- `name` - 显示的标题
- `description` - 你将在下拉框中看到的描述
- `version` - 可以是 "1" （对于旧的提示词文件）或 "2" （这是默认的，不需要设置）

如果你不需要任何这些参数，你可以对 preamble 留空，不需要包含 `---` 分隔符。

### 上下文

很多 [上下文提供者](../context-providers.md) 可以被引用，通过输入 "@" 跟着上下文提供者的名称。当前支持的列表如下：

- `@terminal` - 终端的内容
- `@currentFile` - 当前激活的文件
- `@open` - 所有打开的文件
- `@os` - 操作系统的信息
- `@problems` - 在激活文件中语言服务器生成的问题
- `@repo-map` - 仓库中的文件映射
- `@tree` - 仓库结构的树形视图

或者你可以直接输入 URL 和文件路径：

- `@https://github.com/continuedev/continue` - URL 的内容
- `@src/index.ts` - 文件的内容（仅 VS Code 有效）

所有的引用会作为上下文条目，而不是直接放入行内。

## 反馈

如果你有关于提高 `.prompt` 文件格式的想法，请在 [Discord](https://discord.gg/NWtdYexhMs) 提出。
