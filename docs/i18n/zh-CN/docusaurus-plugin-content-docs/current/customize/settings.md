---
title: 用户设置页面
description: 调整用户指定设置的参考
keywords: [配置, 设置, 配置, 定制, 定制, 侧边栏]
---

# 用户设置页面

**用户设置页面** 可以访问，通过点击 Continue 侧边栏头的齿轮图标。

![slash-commands](/img/header-buttons.png)

这个页面有的：

![User Settings Page](/img/settings-page.png)

点击 `Open Config File` 按钮，打开你的配置文件。查看 [配置参考](../reference.md) 获取更多信息。

除了那些，以下可用的设置，不是配置文件中的：

- `Wrap Codeblocks`: 如果打开，允许代码块中的文本折叠。默认是关闭。
- `Display Raw Markdown`: 如果打开，在响应中显示原始的 markdown 。默认是关闭。
- `Allow Anonymous Telemetry`: 如果打开，允许 Continue 发送匿名的遥测信息。默认是 **打开** 。
- `Disable Indexing`: 阻止代码库的索引，主要用来调试的目的。默认是关闭。
- `Disable Session Titles`: 如果打开，阻止对于每个聊天会话生成总结标题。默认是关闭。
- `Response Text to Speech`: 如果打开，使用 TTL 大声读取 LLM 响应。默认是关闭。
- `Show Chat Scrollbar`: 如果打开，启用聊天窗口的滚动条。默认是关闭。
- `Use autocomplete cache`: 如果打开，缓存补全。
- `Use Chromium for Docs Crawling`: 使用 Chromium 本地爬取文档。有用的，如果默认的 Cheerio 爬取器失败，在需要 JavaScript 渲染的网站上。下载并安装 Chromium 到 `~/.continue/.utils` 。默认是关闭。
- `Codeblock Actions Position`: 设置在代码块上悬停时， action 显示的位置。默认是 `top` 。
- `Multiline Autocompletions`: 控制多行自动补全的补全。可以设置为 `always`, `never` 或 `auto` 。默认是 `auto`
- `Font Size`: 指定 UI 元素的基本字体大小
- `Workspace prompts path`: 在工作区中哪里查找提示词文件 - 替代默认的 `.continue/prompts`
- `Disable autocomplete in files`: 逗号分隔的 glob 模式列表，禁用匹配文件的自动补全。例如， "\_/.md, \*/.txt"
