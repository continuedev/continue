---
title: 如何定制
description: 如何定制 actions
keywords: [定制, actions]
sidebar_position: 5
---

## 内置的斜杠命令

Continue 有一个大的内置斜杠命令库，但是当你首次安装时，我们只显示最常用的一些，比如 "/edit", "/comment" 和 "/share" 。为了添加更多的 action ，你可以打开 [config.json](../customize/config.mdx) 并添加它们到 `slashCommands` 列表中。

## 定制斜杠命令

有两种方法添加定制斜杠命令：

1. 使用 `.prompt` 文件 - 这是大多数情况下推荐的。[在这里](../customize/deep-dives/prompt-files.md) 查看完整参考。
2. 使用 `config.ts` - 这给你对于 LLM, IDE 和其他重要的入口可编程的访问，通过编写 JavaScript/TypeScript 函数

### 使用 `config.ts` 定制斜杠命令

<!-- TODO: We need a config.ts reference -->
<!-- :::tip[config.ts]
Before adding a custom slash command, we recommend reading the [introduction to `config.ts`](../customize/config.mdx).
::: -->

如果你想比使用自然语言编写定制命令更进一步，你可以编写一个定制函数返回响应。这需要使用 `config.ts` 替代 `config.json` 。

要做这个，放一个新的 `SlashCommand` 对象到 `slashCommands` 列表中。这个对象包含 "name" ，你输入用来触发斜杠命令的名字， "description", 在下拉菜单中看到的描述，以及 "run" 。 `run` 函数是任何异步生成器，应该生成你希望流式地返回到 UI 的字符串。作为这个函数的一个参数，你可以访问 `ContinueSDK` 对象实用工具，例如访问 IDE 中确定的信息/action ，当前的语言模型，以及一些其他的实用工具。例如，这是一个生成 commit 说明的斜杠命令：

```typescript title="config.ts"
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

<!-- TODO: We need a config.ts reference -->
<!-- For full `config.ts` reference, see [here](reference/config-ts.md). -->

## 其他定制 action

目前，其他 action 触发器没有开放配置，但是我们计划在未来通过 .prompt 文件来允许。

<!-- For any actions defined in a .prompt file, you can [configure a specific model](TODO). -->
