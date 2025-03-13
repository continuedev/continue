---
description: 配置
keywords: [配置, 设置, 定制]
---

# 配置

## YAML 配置

Continue 可以深度定制。本地的用户级别配置保存和编辑在你的家目录的 `config.yaml` 中：

要打开 `config.yaml` ，你可以点击 Continue 聊天侧边栏上面的 "齿轮" 图标，打开设置页面，然后点击 `Open Config File` 来打开这个文件。当编辑这个文件时，随着你的输入，你可以看到可用的选项建议，或者查看下面的参考。

- `~/.continue/config.yaml` (MacOS / Linux)
- `%USERPROFILE%\.continue\config.yaml` (Windows)

要打开你的配置文件，你可以点击 Continue 聊天侧边栏右下角的 "齿轮" 图标。当编辑这个文件时，随着你的输入，你可以看到可用的选项建议，或者查看下面的参考。

当你在 IDE 中保存配置文件时， Continue 会自动刷新，应用你的变更。配置文件在你第一次使用 Continue 时自动创建，并且如果它不存在，总会使用默认值自动生成。

查看 `config.yaml` 的完整参考 [在这里](../../reference.md) 。

## 废弃的配置方法

:::info
查看 `config.json` 迁移指南 [在这里](../../yaml-migration.md)
:::

- [`config.json`](../../reference.md) - 原始的配置格式，保存为一个文件，和 `config.yaml` 相同的位置
- [`.continuerc.json`](#continuercjson) - 工作区级别配置
- [`config.ts`](#configts) - 高级配置（可能是不需要的） - 一个在你的家目录的 TypeScript 文件，可以用来编程式地修改 (_合并_) `config.json` schema ：
  - `~/.continue/config.ts` (MacOS / Linux)
  - `%USERPROFILE%\.continue\config.ts` (Windows)

### `.continuerc.json`

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

### `config.ts`

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
