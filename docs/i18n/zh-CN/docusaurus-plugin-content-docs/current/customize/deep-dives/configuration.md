---
description: 配置
keywords: [配置, 设置, 定制]
---

# 配置

Continue 可以深度定制。用户级配置被保存和编辑在你的家目录的 [`config.json`](#configjson) 中：

- `~/.continue/config.json` (MacOS / Linux)
- `%USERPROFILE%\.continue\config.json` (Windows)

要打开 `config.json` ，你可以点击 "齿轮" 图标，在 Continue 聊天侧边栏的右下角。当编辑这个文件时，随着你的输入，你可以看到有效的选项，或者检查下面的参考。

当你保存 `config.json` 时， Continue 将自动刷新应用你的修改。 `config.json` 在你第一次使用 Continue 时自动创建。 `config.json` 将自动生成，如果它不存在。

在大多数情况下，你只需要编辑 `config.json` 。不过， Continue 提供了两个更多的方法定制配置：

- [`.continuerc.json`](#continuercjson) - 工作区级别配置。如果你想要限制当前的配置到一个指定的工作区，你可以添加一个 `.continuerc.json` 到你的项目的根目录。这个可以设置合并 _或_ 覆盖用户级别 `config.json`
- [`config.ts`](#configts) - 高级配置（可能不需要） - 一个 TypeScript 文件，在你的家目录，可以用来以编程方式修改（_合并_） `config.json` schema ：
  - `~/.continue/config.ts` (MacOS / Linux)
  - `%USERPROFILE%\.continue\config.ts` (Windows)

## `config.json`

查看完整的参考 `config.json` 在[这里](../../reference.md) 。

## `.continuerc.json`

`.continuerc.json` 的格式和 `config.json` 一样，加上一个 _更多的_ 属性 `mergeBehavior` ，它可以设置为 "merge" 或 "overwrite" 。如果设置为 "merge" （默认情况）， `.continuerc.json` 将应用在 `config.json` 之上（列表和对象被合并）。如果设置为 "overwrite" ，那么 `.continuerc.json` 中每个高级别的属性将会覆盖 `config.json` 中的属性。

示例

```json title=".continuerc.json"
{
  "tabAutocompleteOptions": {
    "disable": true
  },
  "mergeBehavior": "overwrite"
}
```

## `config.ts`

为了编程式地扩展 `config.json` ，你可以放置一个 `config.ts` 脚本在 `config.json` 相同的目录， export 一个 `modifyConfig` 函数，像这样：

```ts title="config.ts"
export function modifyConfig(config: Config): Config {
  config.slashCommands?.push({
    name: "commit",
    description: "Write a commit message",
    run: async function* (sdk) {
      // getDiff 函数使用一个布尔参数，表示是否
      // 包含 diff 中的 unstaged 变更。
      const diff = await sdk.ide.getDiff(false); // 传递 false 排除 unstaged 变更
      for await (const message of sdk.llm.streamComplete(
        `${diff}\n\nWrite a commit message for the above changes. Use no more than 20 tokens to give a brief description in the imperative mood (e.g. 'Add feature' not 'Added feature'):`,
        new AbortController().signal,
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

这可以用在斜杠命令和定制上下文提供者上。
