---
title: 如何定制
description: 如何定制自动补全
keywords: [定制]
sidebar_position: 5
---

Continue 在 [`config.json`](../customize/config.mdx) 提供少量的参数，对于你的特定需求和硬件能力，可以调整找到建议质量和系统性能之间的最佳平衡：

```json title="config.json"
 "tabAutocompleteOptions": {
   "useCopyBuffer": false,
   "maxPromptTokens": 400,
   "prefixPercentage": 0.5,
   "multilineCompletions": "always"
 }
```

- `useCopyBuffer`: 决定剪贴板的内容是否包含在提示词构建中
- `maxPromptTokens`: 设置提示词的最大 token 数，平衡上下文和速度
- `prefixPercentage`: 决定提示词使用光标前代码的比例
- `multilineCompletions`: 控制建议是否可以跨多行 ("always", "never" 或 "auto")

对于所有配置选项和它们的影响的综合指南，查看 [深入理解自动补全](../customize/deep-dives/autocomplete.md) 。
