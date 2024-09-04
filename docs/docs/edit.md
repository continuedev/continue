---
title: Edit
description: Learn more about the Edit feature in Continue
keywords: [edit, cmd l]
---

![edit](/img/edit.gif)

## How to use it

Edit is a convenient way to modify code without leaving your current file. Highlight a block of code, describe your code changes, and a diff will be streamed inline to your file which you can accept or reject.

Edit is best used for small, quick changes such as:

- Writing comments
- Generating unit tests
- Refactoring functions or methods

### Highlight code and activate

Highlight the block of code you would like to modify, and press `cmd/ctrl + i` to activate the edit input.

### Describe code changes

Describe the changes you would like the model to make to your highlighted code. For edits, a good prompt should be relatively short and concise. For longer, more complex tasks, we recommend [using chat](./chat.md).

### Accept or reject changes

Proposed changes appear as inline diffs within your highlighted text.

You can navigate through each proposed change, accepting or rejecting them using `cmd/ctrl + opt + y` (to accept) or `cmd/ctrl + opt + n` (to reject).

You can also accept or reject all changes at once using `cmd/ctrl + shift + enter` (to accept) or `cmd/ctrl + shift + delete` (to reject).

If you want to request a new suggestion for the same highlighted code section, you can use `cmd/ctrl + i` to re-prompt the model.

## Model setup

By default, Edit uses the [same model as Chat](./chat.md) since we recommend a similar, 400B+ parameter model for code edits.

You can configure a different model to be used for edits by updating your [`config.json`](./reference/config.mdx).

## Context selection

### Input

The input you provide is included in the prompt.

### Highlighted code

The highlighted code you’ve selected is included in the prompt. This is the only section of code that the model will attempt to edit.

### Current file

The entire contents of the file containing your highlighted code selection are included as additional context. This gives the model a broader understanding of the code's environment. If the file is too large to fit within the context window, we will trim the file's contents to fit.

## How it works

Using the highlighted code, the contents of the file containing your highlight, and your input instructions, we prompt the model to edit the code according to your instructions. No other additional context is provided to the model.

The model response is then streamed directly back to the highlighted range in your code, where we apply a diff formatting to show the proposed changes.

If you accept the diff, we remove the previously highlighted lines, and if you reject the diff, we remove the proposed changes.

If you would like to view the exact prompt that is sent to the model during an edit, you can [view this in the prompt logs](./troubleshooting.md#check-the-logs).
