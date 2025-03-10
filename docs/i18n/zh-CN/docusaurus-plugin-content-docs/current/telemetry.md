---
title: 遥测
description: 了解 Continue 如何收集匿名使用信息，以及你如何选择退出
keywords: [遥测, 匿名, 使用信息, 选择退出]
---

## 概述
开源的 Continue 扩展收集并报告 **匿名** 使用信息，来帮助我们提高产品。这个数据允许我们有效地理解用户交互，并优化用户体验。你可以在任何时候选择退出遥测收集，如果你倾向与不分享你的使用信息。

我们使用 [Posthog](https://posthog.com/) ，一个产品分析的开源平台，来收集并存储这个数据。为了透明，你可以 [在这里](https://github.com/continuedev/continue/blob/main/gui/src/hooks/CustomPostHogProvider.tsx) 检查实现代码，或者查看我们的 [官方隐私策略](https://continue.dev/privacy) 。

## 跟踪策略

所有开源的 Continue 扩展收集的数据是匿名的，在发送到 PostHog 之前，除去个人可识别信息 (PII) 。我们承诺维护你的数据的隐私和安全。

## 我们跟踪什么

以下使用信息被收集和报告：

- **建议交互:** 你是否接受或拒绝建议（不包括涉及的实际代码或提示词）。
- **模型和命令信息:** 使用的模型和命令的名称。
- **token 指标:** 生成的 token 的数量。
- **系统信息:** 你的操作系统 (OS) 和集成开发环境 (IDE) 的名称。
- **页面浏览量:** 一般页面浏览量统计。

## 如何退出

你可以禁用匿名遥测，通过访问 [用户设置页面](./customize/settings.md) 并修改 "Allow Anonymous Telemetry" 关闭。

另外，在 VS Code 中，你可以禁用遥测，通过你的 VS Code 设置，取消勾选 "Continue: Telemetry Enabled" 方框（这将覆盖设置页面的设置）。 VS Code 设置可以在 `File` > `Preferences` > `Settings` 访问(或使用键盘快捷方式 <kbd>ctrl</kbd> + <kbd>,</kbd> 在 Windows/Linux 上或 <kbd>cmd</kbd> + <kbd>,</kbd> 在 macOS 上).
