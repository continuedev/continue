---
title: Autocomplete Role
description: Autocomplete model role
keywords: [autocomplete, model, role]
sidebar_position: 2
---

An "autocomplete model" is an LLM that is trained on a special format called fill-in-the-middle (FIM). This format is designed to be given the prefix and suffix of a code file and predict what goes between. This task is very specific, which on one hand means that the models can be smaller (even a 3B parameter model can perform well). On the other hand, this means that Chat models, though larger, will often perform poorly even with extensive prompting.

In Continue, autocomplete models are used to display inline [Autocomplete](../../autocomplete/how-to-use-it.md) suggestions as you type. Autocomplete models are designated by adding the `autocomplete` to the model's `roles` in `config.yaml`.

## Recommended Autocomplete models

Visit the [Autocomplete Deep Dive](../deep-dives/autocomplete.mdx) for recommended models and more details.
