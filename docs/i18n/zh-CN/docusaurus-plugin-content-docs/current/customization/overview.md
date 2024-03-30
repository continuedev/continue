---
title: 概述
description: Continue 可以被深度定制
keywords: [自定义, 斜杠命令, 模型, 上下文提供者]
---

# 概述

Continue 可以被深度定制，通过编辑在你机器上的 `~/.continue/config.json` (`%userprofile%\.continue\config.json` 对于 Windows) 和 `config.ts` 。 这些文件在你第一次运行 Continue 时创建。

目前，你可以自定义以下内容：

- [模型](../model-setup/select-model.md) 和 [提供者](../model-setup/select-provider.md)
- [上下文提供者](./context-providers.md) - 输入 '@' 来简单地添加附加内容到你的提示词。定义你想引用哪些资源，包括 GitHub Issues ，终端输出，或者你的代码库的自动检索片段。
- [斜杠命令](./slash-commands.md) - 通过输入 `/` ，调用自定义提示词或者使用我们的 SDK 编写的程序。
- [其他配置](../reference/config.mdx) - 配置其他设置，比如系统信息和温度系数。

如果你想分享 Continue 配置给其他人，你可以在你的项目根目录添加一个 `.continuerc.json` 。它有和 `config.json` 相同的 JSON Schema 定义，将会自动应用在本地 `config.json` 之上。
