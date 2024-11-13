---
title: 斜杠命令
description: 以 '/' 为开头激活的快捷方式
keywords: [斜杠命令, 自定义命令, 步骤]
---

斜杠命令是可以通过输入 '/' 来激活，并从下拉框中选择的快捷方式。例如，内置的 '/edit' 斜杠命令，让你可以直接在你的编辑器中流式地编辑。

![slash-commands](/img/slash-commands.png)

## 内置的斜杠命令

为了使用任何内置的斜杠命令，打开 `config.json` 并添加它到 `slashCommands` 列表中。

### `/Edit`

使用 `ctrl/cmd + L` (VS Code) 或 `ctrl/cmd + J` (JetBrains) 选择代码，然后输入 `/Edit` ，跟着编辑的指令。 Continue 将会流式地在一个并排 diff 编辑器中修改。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit highlighted code"
    }
  ]
}
```

### `/Comment`

Comment 工作就像 `/Edit` ，除了它将自动地给 LLM 注释代码的提示词。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "comment",
      "description": "Write comments for the highlighted code"
    }
  ]
}
```

### `/Share`

生成一个关于你当前聊天历史的可分享的 markdown 副本。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "share",
      "description": "Export the current chat session to markdown",
      "params": { "outputDir": "~/.continue/session-transcripts" }
    }
  ]
}
```

使用 `outputDir` 参数指定你想要把 markdown 文件保存在哪里。

### `/Cmd`

通过自然语言生成一个 shell 命令，并且（只在 VS Code 中）自动地粘贴它到终端中。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "cmd",
      "description": "Generate a shell command"
    }
  ]
}
```

### `/Commit`

显示给 LLM 你当前的 git diff ，并询问生成一个 commit 消息。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "commit",
      "description": "Generate a commit message for the current changes"
    }
  ]
}
```

### `/Http`

编写一个自定义的斜杠命令，在你自己的 HTTP 端点。在参数对象中对于你设置的端点设置 'url' 。端点应该返回一个字符串更新序列，将会流式地输出到 Continue 侧边栏。查看我们基本的 [FastAPI 示例](https://github.com/continuedev/continue/blob/74002369a5e435735b83278fb965e004ae38a97d/core/context/providers/context_provider_server.py#L34-L45) 作为参考。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "http",
      "description": "Does something custom",
      "params": { "url": "<my server endpoint>" }
    }
  ]
}
```

### `/Issue`

描述你想要生成的 issue ， Continue 会转换为格式良好的标题和正文，然后给你一个草稿的链接，让你可以提交。确保设置你想要生成 issue 的仓库的 URL 。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "issue",
      "description": "Generate a link to a drafted GitHub issue",
      "params": { "repositoryUrl": "https://github.com/continuedev/continue" }
    }
  ]
}
```

### `/So`

StackOverflow 斜杠命令将会自动地拉取 StackOverflow 的结果来回答你的问题，引用链接和它的答案一起。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "so",
      "description": "Reference StackOverflow to answer the question"
    }
  ]
}
```

### `/Onboard`

Onboard 斜杠命令帮助你熟悉一个新的项目，通过分析项目结构， README 和依赖文件。它发现关键目录，解释它们的目的，并高亮使用的流行的包。另外，它提供对项目架构的了解。

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "onboard",
      "description": "Familiarize yourself with the codebase"
    }
  ]
}
```
