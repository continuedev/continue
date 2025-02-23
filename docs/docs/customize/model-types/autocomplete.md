---
title: Autocomplete model
description: Autocomplete model
keywords: [autocomplete]
sidebar_position: 1
---

An "autocomplete model" is an LLM that is trained on a special format called fill-in-the-middle (FIM). This format is designed to be given the prefix and suffix of a code file and predict what goes between. This task is very specific, which on one hand means that the models can be smaller (even a 3B parameter model can perform well). On the other hand, this means that Chat models, though larger, will perform poorly.

In Continue, these models are used to display inline [Autocomplete](../../autocomplete/how-to-use-it.md) suggestions as you type.

## Recommended Autocomplete models

If you have the ability to use any model, we recommend `Codestral` with [Mistral](../model-providers/top-level/mistral.mdx#autocomplete-model) or [Vertex AI](../model-providers/top-level/vertexai.mdx#autocomplete-model).

If you want to run a model locally, we recommend `Qwen2.5-Coder 1.5B` with [Ollama](../model-providers/top-level/ollama.mdx#autocomplete-model).
