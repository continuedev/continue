---
title: 自动补全模型
description: 自动补全模型
keywords: [自动补全]
sidebar_position: 1
---

"自动补全模型" 是一个训练在称为中间填充 (FIM) 的特定的格式上的 LLM 。这种格式设计为，给出代码文件的前缀和后缀，预测中间是什么。这种任务很特殊，一方面意味着模型可以较小 (甚至一个 3B 参数模型可以表现很好)。另一方面，这意味着聊天模型，虽然更大，但是表现更差。

在 Continue 中，这些模型用来随着你的输入显示行内 [自动补全](../../autocomplete/how-to-use-it.md) 建议。

## 推荐的自动补全模型

如果你有使用任何模型的能力，我们推荐通过 [Mistral](../model-providers/top-level/mistral.md#autocomplete-model) 使用 `Codestral` 。

如果你想要在本地运行模型，我们推荐通过 [Ollama](../model-providers/top-level/ollama.md#autocomplete-model) 使用 `Starcoder2-3B` 。
