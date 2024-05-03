---
title: 🦔 遥测
description: Continue 收集匿名使用信息
keywords: [telemetry, anonymous, usage info, opt out]
---

# 🦔 遥测

## 概述

Continue 收集并报告 **匿名** 使用信息。这个数据是至关重要的，对于理解我们如何提高产品。你可以在任何时候选择退出它。我们使用 [Posthog](https://posthog.com/) ，一个开源的产品分析平台，来收集和保存数据。你可以查看代码 [这里](https://github.com/continuedev/continue/blob/main/gui/src/hooks/CustomPostHogProvider.tsx) 。

## 我们跟踪什么

我们跟踪

- 你是否接受或拒绝建议（不是代码本身）
- 运行的斜杠命令的名字
- 你的 OS 和 IDE 的名字
- 你配置的默认模型的名字

所有数据都是匿名和个人信息清除的，在发送到 PostHog 之前。

## 如何退出

`~/.continue` 目录包含一个 `config.json` 文件看起来像这样：

```json title="~/.continue/config.json"
{
    "allowAnonymousTelemetry": true,
    ...
}
```

你可以关闭匿名遥测，通过修改 `allowAnonymousTelemetry` 的值为 `false` 。或者，你可以在 VS Code 设置中，取消选中 "Continue: Telemetry Enabled" 框。
