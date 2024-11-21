---
description: 与你的代码库交互
keywords: [交互, 嵌入, 重排器, 代码库, 试验性的]
---

# @Codebase

Continue 索引你的代码库，以便它可以之后自动地拉取你的工作区最相关的上下文。这是通过基于嵌入的检索和关键字搜索结合完成的。默认情况下，所有嵌入都是通过 `all-MiniLM-L6-v2` 本地计算的，保存在 `~/.continue/index` 。

目前，代码库检索功能可用在 "codebase" 和 "folder" 上下文提供者。你可以使用它们，通过在输入框输入 `@Codebase` 或 `@Folder` ，然后询问问题。输入框的内容将会与其他代码库（或目录）的嵌入进行比较，来决定相关的文件。

这是一些通用的使用情况，它是有用的：

- 询问关于你的代码库的高级别问题
  - "我如何添加一个新的端点到服务器？"
  - "我们是否再任何地方使用 VS Code 的 CodeLens 特性？"
  - "这里是否有任何写好的代码将 HTML 转换为 markdown ？"
- 生成代码，使用已有的示例作为参考
  - "生成一个新的有日期选择器的 React 组件，使用与已有组件相同的模式"
  - "使用 Python 的 argparse 编写一个这个项目的 CLI 应用的草稿"
  - "实现一个 `foo` 方法在 `bar` 类中, 根据在其他 `baz` 子类中看到的模式"
- 使用 `@Folder` 询问关于特定目录的问题，增加相关结果的可能性
  - "这个目录的主要目的是什么？"
  - "我们如何使用 VS Code 的 CodeLens API ？"
  - 或者任何上面的示例，但是使用 `@Folder` 代替 `@Codebase`

这是一些使用情况，它是没用的：

- 当你想要 LLM 查看你的代码库中的 _字面上每个_ 文件
  - "查找 `foo` 函数被调用的每个地方"
  - "检查我们的代码库，查找任何拼写错误"
- 重构
  - "添加一个新的参数到 `bar` 函数并更新使用方法"

## 配置

这里有一些选项，让你可以配置 codebase 上下文提供者的行为。这些可以再 `config.json` 设置，对于 codebase 和 folder 上下文提供者是一样的：

```json title="config.json"
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

从向量数据库开始检索的结果数量（默认值： 25）

### `nFinal`

重排之后使用的结果的最终数量（默认值：5）

### `useReranking`

是否使用重排，允许最初选择 `nRetrieve` 结果，然后使用 LLM 选择最上面的 `nFinal` 结果（默认值： true）

## 在索引中忽略文件

Continue 遵守 `.gitignore` 文件，为了确定哪些文件不需要索引。如果你想要忽略更多的文件，你可以添加它们到 `.continueignore` 文件，它遵守和 `.gitignore` 完全相同的规则。

如果你想要查看哪些文件被 Continue 索引，元数据存储在 `~/.continue/index/index.sqlite` 。你可以使用工具，比如 [DB Browser for SQLite](https://sqlitebrowser.org/) 查看这个文件是的 `tag_catalog` 表。

如果你需要强制刷新索引，重新加载 VS Code 窗口使用 `cmd/ctrl + shift + p` + "Reload Window" 。

## 仓库 map

Claude 3, Llama 3.1, Gemini 1.5 和 GPT-4o 家族的模型在代码库检索时会自动地使用 [仓库 map](../context-providers.md#repository-map) ，允许模型理解你的代码库的结构，并使用它回答问题。当前，仓库 map 仅包含代码库中的文件路径。
