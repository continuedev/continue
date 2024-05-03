---
title: 代码库检索
description: 与你的代码库交互
keywords: [交互, 嵌入, 代码库, 试验性的]
---

# 代码库检索

Continue 对你的代码库做索引，以便之后从任何你的工作区自动查找最相关的上下文。这是由基于嵌入的检索和关键字搜索结合完成的。默认情况下，所以嵌入是通过 `all-MiniLM-L6-v2` 本地计算的，保存在本地的 `~/.continue/index` 中。

目前，代码库检索功能在 "codebase" 和 "folder" 上下文提供者中可用。你可以在输入框中输入 `@codebase` 或 `@folder` 来使用它们，然后提出问题。输入框中的内容将与其余代码库（或文件夹）的嵌入进行比较，来决定相关的文件。

这是一些常见的有用的使用情况：

- 提问关于你的代码库的高层次问题
  - "我如何在 server 中添加新的 endpoint ？"
  - "我们有在任何地方使用 VS Code 的 CodeLens 功能吗？"
  - "这里是否已经有代码可以将 HTML 转换为 markdown ？"
- 使用已存在的样例作为引用来生成代码
  - "使用日期选择器生成一个新的 React 组件，使用现存组件相同的模式"
  - "使用 Python 的 argparse 编写这个项目 CLI 应用草稿"
  - "在 `bar` 类中实现 `foo` 方法，根据另一个子类 `baz` 的模式"
- 使用 `@folder` 提问关于指定文件夹的问题，增加相关结果的关联性
  - "这个文件夹的主要目的是什么？"
  - "我们如何使用 VS Code 的 CodeLens API ？"
  - 或者任何上面的示例，但是使用 `@folder` 替换 `@codebase`

这是一些无用的使用情况：

- 当你需要 LLM 看到你的代码库中 _字面意义上每个_ 文件
  - "找到所有 `foo` 函数调用的地方"
  - "检查我们的代码库，并查找任何拼写错误"
- 重构
  - "添加一个新的参数到 `bar` 函数并更新用法"

## 配置

有一些配置可以让你配置 codebase 上下文提供者的行为。它们可以在 `config.json` 中设置，对于 codebase 和 folder 上下文提供者是相同的：

```json title="~/.continue/config.json"
{
  "contextProviders": [
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ]
}
```

### `nRetrieve`

从向量数据库中最初检索的结果数量（默认： 25）

### `nFinal`

重新排序之后要使用的结果的最终数量（默认：5）

### `useReranking`

是否使用重新排序，它允许 `nRetrieve` 最初选择结果，然后使用 LLM 选择最上 `nFinal` 结果 (默认： true)

## 嵌入提供者

我们也支持其他方法生成嵌入，可以使用 `"embeddingsProvider"` 属性在 `config.json` 中配置。我们目前有下面这些提供者的内置支持：

### Transformers.js

[Transformers.js](https://huggingface.co/docs/transformers.js/index) 是流行的 [Transformers](https://huggingface.co/transformers/) 库的一个 JavaScript 移植。它允许嵌入在本地浏览器中计算（或者这种情况下，在你的 IDE 的侧边栏中）。模型使用的是 `all-MiniLM-L6-v2` ，跟随 Continue 扩展，生成 384 大小的嵌入。

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

### Ollama

[Ollama](https://ollama.ai) 是启动和运行开源语言模型的最简单的方式。它提供一个使用 LLM 的完全本地 REST API ，包括生成嵌入。嵌入生成比较大，对于 `codellama:7b` ，大小是 4096 。

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "codellama:7b",
    "apiBase": "http://localhost:11434" // 可选，默认是 http://localhost:11434
  }
}
```

### OpenAI

OpenAI 的 [嵌入](https://platform.openai.com/docs/guides/embeddings) 是高维嵌入，对于文本和代码都有良好的性能。

text-embedding-3-small 模型的配置。这是默认的。
text-embedding-3-small 模型提供了在性能和效率之间优秀的平衡，适用于多功能的应用。

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // 可选，默认是 OpenAI API
  }
}
```

text-embedding-3-large 模型的配置。
对于那些需要最高级的嵌入细节和精度， text-embedding-3-large 模型是更好的选择。

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // 可选，默认是 OpenAI API
  }
}
```

遗留的模型配置。
对于指定场景，你可能仍然发现 text-embedding-ada-002 模型相关。下面是配置示例：

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // 可选，默认是 OpenAI API
  }
}
```

### 编写一个自定义的 `EmbeddingsProvider`

如果你有自己生成嵌入的 API 能力， Continue 可以简单地编写一个自定义 `EmbeddingsProvider` 。你需要做的就是，编写一个函数，将字符串转换为数字列表，并将它加入到你的 `config.ts` 配置中。这是一个示例：

```ts title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.embeddingsProvider = {
    embed: (chunks: string[]) => {
      return Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch("https://example.com/embeddings", {
            method: "POST",
            body: JSON.stringify({ text: chunk }),
          });
          const data = await response.json();
          return data.embedding;
        })
      );
    },
  };

  return config;
}
```

## 自定义哪个文件进行索引

Continue 关注 `.gitignore` 文件，决定哪个文件不被索引。如果你想要排除更多的文件，你可以把它们加入到 `.continueignore` 文件，遵守 `.gitignore` 完全相同的规则。

如果你想准确地查看哪个文件被 Continue 索引，元数据存储在 `~/.continue/index/index.sqlite` 中。你可以使用工具，比如 [DB Browser for SQLite](https://sqlitebrowser.org/) 来查看这个文件的 `tags_catalog` 表。

如果你希望强制更新索引，使用 `cmd/ctrl + shift + p` + "重新加载窗口" 重新加载 VS Code 窗口。
