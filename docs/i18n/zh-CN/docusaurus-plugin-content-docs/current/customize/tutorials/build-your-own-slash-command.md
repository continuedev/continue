---
title: 构建你自己的斜杠命令
---

这里有两种方式可以添加自定义斜杠命令：

1. 使用自然语言提示词 - 这个比较简单，只需要编写一个字符串或字符串模板。
2. 使用一个自定义函数 - 这个给你完全访问 Continue SDK 并允许你编写任意的 Typescript 代码。

### "自定义命令" (使用自然语言)

你可以添加自定义斜杠命令，通过添加到 `config.json` 中的 `customCommands` 属性。

- `name`: 命令的名称，使用 `/name` 触发
- `description`: 命令的一个简短描述，会出现在下拉框中
- `prompt`: 一个模板的提示词发送给 LLM

当你频繁使用一个提示词时，自定义命令很好用。例如，如果你精心制作了一个很好的提示词，频繁地问 LLM 检查你代码中的错误，你可以添加一个命令，像这样：

```json title="config.json"
customCommands=[{
        "name": "check",
        "description": "Check for mistakes in my code",
        "prompt": "{{{ input }}}\n\nPlease read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
}]
```

#### 模板

`prompt` 属性支持 Handlebars 语法的模板。你可以使用以下参数：

- `input` （在上面的例子中使用）： 斜杠命令的任何额外输入。例如，如果你输入 `/test only write one test` ， `input` 将是 `only write one test` 。这还将包含高亮的代码块。
- 文件名称： 你可以引用任何文件，通过提供绝对路径或当前工作目录的相对路径。

### 自定义斜杠命令

如果你想要比使用自然语言编写自定义命令更进一步，你可以编写一个自定义函数返回响应。这需要使用 `config.ts` 代替 `config.json` 。

为了做这个，放一个新的 `SlashCommand` 对象到 `slashCommands` 列表中。这个对象包含 "name" ，你用来触发斜杠命令的名称， "description" ，在下拉菜单中看到的描述，以及  "run" 。 `run` 函数是任何异步生成器，应该生成你想要流式输出到 UI 的字符串。作为函数的参数，你可以访问一个有实用工具的 `ContinueSDK` 对象，例如访问 IDE 中的当前信息/action ，当前语言模型，以及一些其他实用工具。例如，这是一个生成 commit 信息的斜杠命令：

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
        },
      )) {
        yield message;
      }
    },
  });
  return config;
}
```
