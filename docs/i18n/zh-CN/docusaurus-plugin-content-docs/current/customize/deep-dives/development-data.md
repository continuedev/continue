---
title: 开发数据
description: 收集你如何构建软件的数据
keywords: [开发数据, dev 数据, LLM-辅助开发]
---

当使用 Continue 时，你自动地收集如何构建软件的数据。默认情况下，这个开发数据保存在你本地机器上的 `.continue/dev_data` 。

你可以了解更多关于开发数据是如何生成的，作为 LLM 辅助编程的副产品，以及为什么我们相信你应该现在开始收集它： [It’s time to collect data on how you build software](https://blog.continue.dev/its-time-to-collect-data-on-how-you-build-software)

## 定制数据目标

你还可以配置你的数据的定制目标，包括远程 HTTP 端点和本地文件目录。

对于 hub 助手，数据目标在 `data` 块配置。访问 hub [查看数据块示例](https://hub.continue.dev/explore/data) 或 [创建你自己的](https://hub.continue.dev/new?type=block&block=data) 。

查看更多详情关于添加 `data` 块到你的配置文件中，在 [YAML specification](../../yaml-reference.md#data)

当发送开发数据到你自己的 HTTP 端点时，它将接收一个事件 JSON blob 以给定的 `schema` 版本。你可以查看事件名称， schema 版本和字段 [在这里，在源码中](https://github.com/continuedev/continue/tree/main/packages/config-yaml/src/schemas/data) 。

