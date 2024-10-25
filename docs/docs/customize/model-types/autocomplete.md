---
title: Autocomplete model
description: Autocomplete model
keywords: [autocomplete]
sidebar_position: 1
---

An "autocomplete model" is an LLM that is trained on a special format called fill-in-the-middle (FIM). This format is designed to be given the prefix and suffix of a code file and predict what goes between. This task is very specific, which on one hand means that the models can be smaller (even a 3B parameter model can perform well). On the other hand, this means that Chat models, though larger, will perform poorly.

In Continue, these models are used to display inline [Autocomplete](../../autocomplete/how-to-use-it.md) suggestions as you type.

## Recommended Autocomplete models

If you have the ability to use any model, we recommend `Codestral` with [Mistral](../model-providers/top-level/mistral.md#autocomplete-model) or [Mistral Vertex AI](../model-providers/more/mistral-vertexai.md#autocomplete-model).

If you want to run a model locally, we recommend `Starcoder2-3B` with [Ollama](../model-providers/top-level/ollama.md#autocomplete-model).
