---
description: 了解如何在 Continue 中访问和搜索你的项目文档
keywords: [文档, 索引, 上下文提供者, 嵌入, 文档]
toc_max_heading_level: 5
---

# @Docs

[`@Docs` 上下文提供者](http://localhost:3000/customization/context-providers#documentation) 允许你直接通过 Continue 与自己的文档交互。这个特性运行你索引任何静态网站或 Github markdown 页面，让你在编码时访问和利用你的文档更方便。

## 启用 `@Docs` 上下文提供者

为了启用 `@Docs` 上下文提供者，你需要添加它到你的 `config.json` 文件中的上下文提供者列表。

```json
{
  "contextProviders": [
    {
      "name": "docs"
    }
  ]
}
```

## 它是如何工作的

`@Docs` 上下文提供者通过爬取指定的文档网站工作，生成嵌入，把它们保存再本地。这个过程允许快速有效地访问你的文档内容。

1. 我们爬取指定的文档网站
2. 生成内容的嵌入
3. 本地保存嵌入在你的机器上
4. 通过 `@Docs` 上下文提供者提供访问索引内容

### 通过 `@Docs` 上下文提供者

为了添加一个单独的文档网站，我们推荐使用 `@Docs` 上下文提供者。

1. 在聊天面板输入 `@Docs` ，点击回车
2. 输入 "add" 并选择 "Add Docs" 选项
3. 输入需要的信息到对话框

索引将在提交之后开始。

### 通过 `config.json`

为了添加多个文档网站，我们推荐批量添加它们到你的 `config.json` 文件中。索引将在文件保存后开始。

[docs 的配置 schema](https://github.com/continuedev/continue/blob/v0.9.212-vscode/extensions/vscode/config_schema.json#L1943-L1973) 如下：

```json
"docs": [
    {
    "title": "Continue",
    "startUrl": "https://docs.continue.dev/intro",
    "faviconUrl": "https://docs.continue.dev/favicon.ico",
  }
]
```

- `title`: 文档网站的名称，用来在 UI 中进行识别。
- `startUrl`: 索引进程开始的 URL 。
<!-- - `rootUrl`: 文档网站的基本 URL ，用来确定哪个页面索引。 -->
- `faviconUrl`: 网站 favicon 的 URL ，用来在 UI 中进行视觉识别。

## 使用 `useChromiumForDocsCrawling` 爬取动态生成的网站

默认情况下，我们使用一个轻量的工具爬取文档网站，它不能渲染使用 JavaScript 动态生成的网站。

If you want to crawl a site that is dynamically generated, or you get an error while attempting to crawl a site, you can enable the experimental `useChromiumForDocsCrawling` feature in your `config.json`. This will download and install Chromium to `~/.continue/.utils`.

如果你想要爬取一个动态生成的网站，或者当你爬取网站时得到一个错误，你可以在你的 `config.json` 启用试验性的 `useChromiumForDocsCrawling` 特性。这将下载并安装 Chromium 到 `~/.continue/.utils` 。

```json title="config.json"
"experimental": {
    "useChromiumForDocsCrawling": true
}
```

## 常见问题

### 索引内容多长时间更新？

当前，我们没有自动地重新索引你的文档。如果你想要强制重新刷新，你可以使用下面的命令： `Continue: Docs Force Re-Index` 。
