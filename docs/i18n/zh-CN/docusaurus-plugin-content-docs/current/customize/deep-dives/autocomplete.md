---
title: 自动补全
keywords: [自动补全]
---

### 设置 Codestral (推荐)

如果你想要有最好的自动补全体验，我们推荐使用 Codestral ，它可以通过 [Mistral API](https://console.mistral.ai/) 使用。要做这个，获取一个 API key 并把它添加到你的 `config.json` 中：

```json
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "YOUR_API_KEY"
  }
}
```

### 设置 Ollama (默认)

如果你想要本地运行自己的自动补全模型，我们推荐使用 Ollama 。要做这个，首先从 [这里](https://ollama.ai) 下载最新版的 Ollama 。然后，运行下面的命令下载我们推荐的模型：

```bash
ollama run starcoder2:3b
```

一旦它下载完成，你应该可以再 VS Code 中看到补全。

### 设置自定义模型

所有配置选项对聊天可用的模型对 tab 自动补全可用。例如，如果你想要使用一个远程 Ollama 实例，你应该编辑你的 `config.json` 像这样（注意，它不在 models 列表中）：

```json title="config.json"
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "starcoder2:3b",
        "apiBase": "https://<my endpoint>"
    },
    ...
}
```

如果你对可用选项不熟悉，你可以在 [这里](../../reference.md) 查找完整的参考。

## 配置选项

以下可以在 `config.json` 配置：

### `tabAutocompleteModel`

这是另一个对象，就像 `config.json` 中的 `"models"` 列表。你可以选择和配置任何你想要的模型，但是我们强烈建议使用针对 tab 自动补全的小的模型，例如 `deepseek-1b`, `starcoder-1b` 或 `starcoder2-3b` 。

### `tabAutocompleteOptions`

这个对象允许你定制 tab 自动补全的行为。可用的选项显示在下面，你可以在 [这里](https://github.com/continuedev/continue/blob/fbeb2e4fe15d4b434a30a136f74b672485c852d9/core/util/parameters.ts) 找到它们的默认值。

- `disable`: 禁用自动补全（也可以在 IDE 配置中完成）
- `template`: 一个用来自动补全的可选的模板字符串。它使用 Mustache 模板语言渲染，并且传递 'prefix' 和 'suffix' 变量。（字符串）
- `useFileSuffix`: 决定是否使用文件后缀在提示词中。（布尔型）
- `maxPromptTokens`: 提示词使用的 token 的最大数量。一个较小的数字生成较快的补全，但是较少的上下文。（数字）
- `prefixPercentage`: 输入专注于前缀的百分比。（数字）
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `maxSuffixPercentage`: 提示词专注于后缀的最大百分比。（数字）
- `debounceDelay`: 在按键之后触发自动补全的毫秒延迟。（数字）
- `multilineCompletions`: 是否启用多行补全 ("always", "never" 或 "auto") 。默认情况下是 "auto" 。
- `useCache`: 是否缓存和重新使用补全，当提示词与前一个相同时。对于测试的目的可能是有用的。
- `disableInFiles`: 一个你想要禁用 tab 自动补全的 glob 模式的文件列表。

### 完整示例

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder2:3b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "debounceDelay": 500,
    "maxPromptTokens": 1500,
    "disableInFiles": ["*.md"]
  }
}
```

## 常见问题

### 我想要更好的补全，是否应该使用 GPT-4 ？

可能出乎意料，答案是否定的。我们推荐的自动补全模型是通过高度特定提示词格式训练的，这运行它们响应请求来补全代码(在 [这里](https://github.com/continuedev/continue/blob/d2bc6359e8ebf647892ec953e418042dc7f8a685/core/autocomplete/templates.ts) 查看这些提示词的示例)。一些最好的商业化模型，比如 GPT-4 或 Claude 不是通过这种提示词格式训练的，这意味着它们不能生成有用的补全。幸运地，好的自动补全不需要很大的模型。大多数先进的自动补全模型不大于 10b 参数，增加超过这个没有明显地提高性能。

### 我没有看到任何补全

查看下面的步骤，确认所有东西设置正确：

1. 确保你有 "Enable Tab Autocomplete" 设置勾选，（在 VS Code 中，你可以切换，通过点击状态栏中的 "Continue" 按钮，在 JetBrains 中，通过 Settings -> Tools -> Continue ）。
2. 确保你下载了 Ollama 。
3. 运行 `ollama run starcoder2:3b` 确认模型下载完成。
4. 确保任何其他补全提供者被禁用（例如 Copilot ），它们可能会干扰。
5. 检查输出的日志，查找可能得错误（ cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab 在 VS Code 中，~/.continue/logs/core.log 在 JetBrains 中）。
6. 检查 VS Code 设置，确保 `"editor.inlineSuggest.enabled"` 设置为 `true` （使用 `cmd/ctrl+,` 然后搜索这个并勾选方框）
7. 如果你仍然有问题，请在我们的 [Discord](https://discord.gg/vapESyrFmJ) 让我们知道，我们将会尽快提供帮助。

### 补全太慢

基于你的硬件，你想要尝试一个更小、更快的模型。如果 3b 不能对你有效工作，我们推荐尝试 `deepseek-coder:1.3b-base` 。

### 补全总是单行的

为了确保你能收到多行补全，你可以设置 `"multilineCompletions": "always"` 再 `tabAutocompleteOptions` 中。默认情况下，它是 `"auto"` 。如果你仍然发现你只能看到单行补全，这可能是因为一些模型偏向产生短的补全，当在文件中开始时。你可以尝试临时移动光标下的文本到激活文件外，或者切换到一个更大的模型。

### 我是否可以配置自动补全 "trigger key" ？

是的，在 VS Code 中，如果你不想要自动显示建议，你可以：

1. 设置 `"editor.inlineSuggest.enabled": false` 在 VS Code 设置中，禁止自动建议
2. 打开 "快捷键" (cmd/ctrl+k, cmd/ctrl+s) 并查找 `editor.action.inlineSuggest.trigger`
3. 点击 "+" 图标添加一个新的键绑定
4. 按下你想要触发建议的键组合（例如 `ctrl+space`）
5. 现在，无论何时你想要查看建议，按下键绑定（例如，`ctrl+space` ）来手动触发建议

### 是否有快捷键一次接受一行？

这是 VS Code 的一个内置特性，但是比较隐藏。查看这个很好的 [StackOverflow 回答](https://stackoverflow.com/questions/72228174/accept-line-by-line-from-autocompletion/78001122#78001122) 获取更多信息。

### 如何关闭自动补全

#### VS Code

点击屏幕右下角状态栏中的 "Continue" 按钮。选择标志会变成 "cancel" 符号，你将不会再看到补全。你可以再次点击它，重新打开补全。

另外，打开 VS Code 设置，搜索 "Continue" 并取消勾选 "Enable Tab Autocomplete" 方框。

#### JetBrains

打开 Settings -> Tools -> Continue 并取消勾选 "Enable Tab Autocomplete" 方框。

#### 反馈

如果你关闭自动补全，我们想要知道如何提高！请让我们知道，在我们的 [Discord](https://discord.gg/vapESyrFmJ) 或者在 GitHub 提交一个 issue 。
