---
title: Context selection
sidebar_position: 3
description: How to select context for Edit
keywords: [edit, cmd i, works]
---

## Input

The input you provide is included in the prompt.

## Highlighted code

The highlighted code you’ve selected is included in the prompt. This is the only section of code that the model will attempt to edit.

## Current file

The entire contents of the file containing your highlighted code selection are included as additional context. This gives the model a broader understanding of the code's environment. If the file is too large to fit within the context window, we will trim the file's contents to fit.