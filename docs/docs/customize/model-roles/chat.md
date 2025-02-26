---
title: Chat Role
description: Chat model role
keywords: [chat, model, role]
sidebar_position: 1
---

A "chat model" is an LLM that is trained to respond in a conversational format. Because they should be able to answer general questions and generate complex code, the best chat models are typically large, often 405B+ parameters.

In Continue, these models are used for [Chat](../../chat/how-to-use-it.md) and [Actions](../../actions/how-to-use-it.md). The selected chat model will also be used for [Edit](../../edit/how-to-use-it.md) and [Apply](./apply.mdx) if no `edit` or `apply` models are specified, respectively.

## Recommended Chat models

If you have the ability to use any model, we recommend [Claude 3.7 Sonnet](../model-providers/top-level/anthropic.mdx).

Otherwise, some of the next best options are:

- [GPT-4o](../model-providers/top-level/openai.mdx)
- [Grok-2](../model-providers/top-level/xAI.mdx)
- [Gemini 1.5 Pro](../model-providers/top-level/gemini.mdx)
- [Llama3.1 405B](../tutorials/llama3.1.mdx)
