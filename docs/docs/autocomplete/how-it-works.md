---
title: How it works
description: How Autocomplete works
keywords: [how, autocomplete, context]
sidebar_position: 4
---

Autocomplete is a [compound AI system](https://bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/) that uses a combination of retrieval methods and response processing techniques. The system can be understood in roughly three parts.

## Timing

In order to display suggestions quickly, without sending too many requests, we do the following:

- Debouncing: If you are typing quickly, we won't make a request on each keystroke. Instead, we wait until you have finished.
- Caching: If your cursor is in a position that we've already generated a completion for, this completion is reused. For example, if you backspace, we'll be able to immediately show the suggestion you saw before.

## Context

As explained on the [context selection](context-selection.md) page, Continue uses a number of retrieval methods to find relevant snippets from your codebase to include in the prompt.

## Filtering

Language models aren't perfect, but can be made much closer by adjusting their output. We do extensive post-processing on responses before displaying a suggestion, including:

- filtering out special tokens
- stopping early when re-generating code
- fixing indentation

We will also occasionally entirely filter out responses if they are bad. This is often due to extreme repetition.

You can learn more about how it works in the [Autocomplete deep dive](../customize/deep-dives/autocomplete.md).
