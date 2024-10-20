---
title: 遥测
description: 了解 Continue 如何收集匿名使用信息，以及你如何选择退出
keywords: [遥测, 匿名, 使用信息, 选择退出]
---

## 概述
Continue 收集并报告 **匿名** 使用信息，来帮助我们提高产品。这个数据允许我们有效地理解用户交互，并优化用户体验。你可以在任何时候选择退出遥测收集，如果你倾向与不分享你的使用信息。

我们使用 [Posthog](https://posthog.com/) ，一个产品分析的开源平台，来收集并存储这个数据。为了透明，你可以 [在这里](https://github.com/continuedev/continue/blob/main/gui/src/hooks/CustomPostHogProvider.tsx) 检查实现代码，或者查看我们的 [官方隐私策略](https://continue.dev/privacy) 。

## 跟踪策略

所有 Continue 收集的数据是匿名的，在发送到 PostHog 之前，除去个人可识别信息 (PII) 。我们承诺维护你的数据的隐私和安全。

## 我们跟踪什么

以下使用信息被收集和报告：

- **建议交互:** 你是否接受或拒绝建议（不包括涉及的实际代码或提示词）。
- **模型和命令信息:** 使用的模型和命令的名称。
- **token 指标:** 生成的 token 的数量。
- **系统信息:** 你的操作系统 (OS) 和集成开发环境 (IDE) 的名称。
- **页面浏览量:** 一般页面浏览量统计。

## 如何退出

你可以通过修改位于 `~/.continue` 目录中 `config.json` 文件禁用匿名遥测。这个文件通常包含以下条目：

```json title="config.json"
{
  "allowAnonymousTelemetry": true
}
```

为了退出，修改 `allowAnonymousTelemetry` 的值为 `false` 。另外，你可以通过 VS Code 设置禁用遥测，通过取消勾选 "Continue: Telemetry Enabled" 选择框。

### 通过配置文件禁用遥测的步骤

1. 用你的文件编辑器打开 `~/.continue/config.json` 文件。
2. 定位到 `"allowAnonymousTelemetry"` 设置。
3. 将值从 `true` 修改为 `false` 。
4. 保存文件。

### 通过 VS Code 设置禁用遥测

1. 打开 VS Code 。
2. 导航到 `File` > `Preferences` > `Settings` (或在 Windows/Linux 上使用快捷键 `Ctrl + ,` 或在 macOS 上使用 `Cmd + ,` )。
3. 在搜索栏中，输入 "Continue: Telemetry Enabled" 。
4. 取消勾选 "Continue: Telemetry Enabled" 选择框。
