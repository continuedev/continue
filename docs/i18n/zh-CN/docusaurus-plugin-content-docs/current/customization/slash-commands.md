---
title: 斜杠命令
description: 可以通过 '/' 开头的输入来激活的快捷方式
keywords: [斜杠命令, 自定义命令, step]
---

# 斜杠命令

斜杠命令是可以通过输入 '/' 激活，并且从下拉框中选择的快捷方式。例如，内置的 `/edit` 斜杠命令，让你直接在你的编辑器中进行流式编辑。

![斜杠命令](/img/slash-commands.png)

## 内置的斜杠命令

为了使用任何内置的斜杠命令，打开 `~/.continue/config.json` 并将它加入到 `slashCommands` 列表中。

### `/edit`

使用 ctrl/cmd + M (VS Code) 或 ctrl/cmd + J (JetBrains) 选择代码，然后输入 `/edit` ，后面跟着编辑的指令。 Continue 将修改流式输出到并排的 diff 编辑器中。

```json
{
  "name": "edit",
  "description": "Edit highlighted code"
}
```

### `/comment`

注释和 `/edit` 的工作方式类似，除了它自动地提示 LLM 来注释代码。

```json
{
  "name": "comment",
  "description": "Write comments for the highlighted code"
}
```

### `/share`

输入 `/share` 来生成一个你的当前聊天历史可分享的 markdown 副本。

```json
{
  "name": "share",
  "description": "Download and share this session"
}
```

### `/cmd`

从自然语言生成一个 shell 命令，（只在 VS Code 中）自动粘贴到终端中。

```json
{
  "name": "cmd",
  "description": "Generate a shell command"
}
```

### `/commit`

给 LLM 展示你当前的 git diff ，让它生成一个 commit 消息。

```json
{
  "name": "commit",
  "description": "Generate a commit message for the current changes"
}
```

### `/http`

编写一个自定义的斜杠命令，到你自己的 HTTP 端点。在 params 对象中 'url' 设置你配置的端点。端点应该返回一系列的字符串更新，将会流式输入到 Continue 侧边栏。查看我们基本的 [FastAPI 示例](https://github.com/continuedev/continue/blob/74002369a5e435735b83278fb965e004ae38a97d/core/context/providers/context_provider_server.py#L34-L45) 作参考。

```json
{
  "name": "http",
  "description": "Does something custom",
  "params": { "url": "<my server endpoint>" }
}
```

### `/issue`

描述你想生成的 issue ， Continue 将转换为一个格式良好的标题和正文，然后给你一个草稿的链接，让你可以提交。确认设置你想要生成 issue 的仓库的 URL 。

```json
{
  "name": "issue",
  "description": "Generate a link to a drafted GitHub issue",
  "params": { "repositoryUrl": "https://github.com/continuedev/continue" }
}
```

### `/so`

StackOverflow 斜杠命令将自动从 StackOverflow 拉取结果来回答你的问题，相关链接和答案一起。

```json
{
  "name": "so",
  "description": "Reference StackOverflow to answer the question"
}
```

## 自定义斜杠命令

有两种方式来添加自定义斜杠命令：

1. 使用自然语言提示词 - 这是比较简单的，只需要编写一个字符串或字符串模板。
2. 使用自定义函数 - 这给你 Continue SDK 的完全访问，允许你编写任何的 Typescript 代码。

### 自定义命令（使用自然语言）

你可以添加自定义斜杠命令，通过添加 `customCommands` 属性在 `config.json` 中。

- `name`: 命令的名称，将使用 `/name` 调用
- `description`: 命令的简单描述，将会在下拉框中出现
- `prompt`: 一系列到 LLM 的指令，将会在提示词中展示

当你需要频繁地重新使用一个提示词时，自定义命令是好的。例如，如果你制作了一个好的提示词，频繁询问 LLM 来检查你代码中的错误，你可以添加一个这样的命令：

```json title="~/.continue/config.json"
customCommands=[{
        "name": "check",
        "description": "Check for mistakes in my code",
        "prompt": "Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
}]
```

### 自定义斜杠命令

如果你想比使用自然语言编写自定义命令更进一步，你可以编写一个自定义函数返回响应。这需要使用 `config.ts` 而不是 `config.json` 。

为了做这个，在 `slashCommands` 列表中添加一个新的 `SlashCommand` 对象。这个对象包含 "name" ，你要调用那个斜杠命令的名称， "description" ，在下拉框菜单中看到的描述，以及 "run" 。 `run` 函数是任何异步生成器，应该生成你希望它们流式输出到 UI 的字符串。作为这个函数的参数，你可以使用工具访问 `ContinueSDK` 对象，比如访问一个 IDE 中指定的信息/动作，当前的语言模型，以及一些其他工具。例如，这是一个斜杠命令，用来生成 commit 消息：

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.slashCommands?.push({
    name: "commit",
    description: "Write a commit message",
    run: async function* (sdk) {
      const diff = await sdk.ide.getDiff();
      for await (const message of sdk.llm.streamComplete(
        `${diff}\n\nWrite a commit message for the above changes. Use no more than 20 tokens to give a brief description in the imperative mood (e.g. 'Add feature' not 'Added feature'):`,
        {
          maxTokens: 20,
        }
      )) {
        yield message;
      }
    },
  });
  return config;
}
```
