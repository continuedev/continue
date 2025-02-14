---
title: 提示词文件
---

提示词文件提供一个方便的方式，来标准化通用模式，并与你的团队分享一批 LLM 提示词。它们让构建和使用这些提示词更简单。

## 快速开始

:::tip[提示词库]
为了帮助你开始，[我们精心编写了一个小的 `.prompt` 文件库](https://github.com/continuedev/prompt-file-examples)。我们鼓励社区贡献到这个仓库，所有请考虑为你的 prompt 创建一个拉取请求！
:::

以下是一个快速示例，设置一个 prompt 文件使用 Jest 编写单元测试。

1. 创建一个名为 `.prompts/` 的目录，再你的工作区的最高层级。
2. 添加一个名为 `test.prompt` 的文件到这个目录中。这个文件的名称将是斜杠命令的名称，你用来生成提示词。
3. 写入以下内容到 `test.prompt` 并保存。

```
temperature: 0.5
maxTokens: 4096
---
<system>
You are an expert programmer
</system>

{{{ input }}}

Write unit tests for the above selected code, following each of these instructions:
- Use `jest`
- Properly set up and tear down
- Include important edge cases
- The tests should be complete and sophisticated
- Give the tests just as chat output, don't edit any file
- Don't explain how to set up `jest`
```

现在使用这个提示词，你可以高亮代码，并使用 `cmd/ctrl+L` 来选择它到 Continue 侧边栏中。

然后，输入 "/" 来查看斜杠命令列表，选择名为 "test" 的那个。按下 enter ，LLM 会响应你的 prompt 文件中给出的指令。

## 格式

格式来自 [HumanLoops 的 .prompt 文件](https://docs.humanloop.com/docs/prompt-file-format) ，并通过额外的模板，使用上下文提供者和内置的变量，使用 [Handlebars 语法](https://handlebarsjs.com/guide/) 。

:::info
这个格式的当前状态时试验性的，并且可能变更
:::

### preamble

"preamble" 是 `---` 分隔符之上的任何东西，让你可以指定模型参数。它使用 YAML 语法，当前支持以下参数：

- `name`
- `temperature`
- `topP`
- `topK`
- `minP`
- `presencePenalty`
- `frequencyPenalty`
- `mirostat`
- `stop`
- `maxTokens`
- `description`

如果你不需要任何这些参数，你可以对 preamble 留空，不需要包含 `---` 分隔符。

### 系统信息

为了添加一个系统信息，使用 `<system></system>` tag 开始 body ，例如上面的例子，并将你的系统信息放入其中。

### 内置变量

下面的内置变量当前是可用的：

- `{{{ input }}}` - 侧边栏中输入框中与斜杠命令一起发送的全部文本
- `{{{ currentFile }}}` - 当前在你的 IDE 中打开的文件
- `{{{ ./path/to/file.js }}}` - 可以直接引用的任何文件

### 上下文提供者

任何你添加到配置中的 [上下文提供者](../context-providers.mdx) ，可以使用上下文提供者的名称引用。接收输入的上下文提供者也支持。

- `{{{ terminal }}}` - 终端的内容
- `{{{ url "https://github.com/continuedev/continue" }}}` - URL 的内容

## 反馈

如果你有关于提高 `.prompt` 文件格式的想法，请在 [Discord](https://discord.gg/NWtdYexhMs) 提出。
