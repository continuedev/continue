---
title: How it works
description: \-how it works
keywords: [how, autocomplete, context]
---

# How it works

Continue’s autocomplete is a [compound AI system]() that uses a combination of retrieval methods and response processing techniques. The system can be understood in roughly three parts.

## Timing

## Context

## Filtering

Continue's autocomplete analyzes your code context, including the current file, cursor position, and recent edits. It crafts a smart prompt using this information and relevant snippets from other files. The system then uses a language model to generate code suggestions, which can include multi-line completions or edits to existing code. These suggestions are refined for relevance and correctness, with successful completions cached for future use. Finally, the system displays the suggestions as ghost text for new additions or diff popups for modifications, allowing you to easily understand and incorporate the proposed changes.
