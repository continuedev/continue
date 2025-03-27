---
title: Context selection
sidebar_position: 3
description: How to select context for Edit
keywords: [edit, cmd i, works]
---

## Input

The input you provide is included in the prompt.

## Code to Edit

The **entire contents** of each file (the current file for Jetbrains inline Edit, each `Code to Edit` item for VS Code Edit mode) are included in the prompt for context. The model will only attempt to edit the highlighted/specified ranges.

## Context Providers

In VS Code Edit mode, you can use `@` to add context using [Context Providers](../customize/context-providers.mdx), similar to [Chat](../chat/context-selection.md). Some context providers may be disabled in Edit mode.
