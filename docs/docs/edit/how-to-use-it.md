---
title: Edit
sidebar_position: 1
sidebar_label: How to use it
description: How to use Edit
keywords: [edit, cmd l, use]
---

![edit](/img/edit.gif)

## How to use it

Edit is a convenient way to modify code without leaving your current file. Highlight a block of code, describe your code changes, and a diff will be streamed inline to your file which you can accept or reject.

Edit is best used for small, quick changes such as:

- Writing comments
- Generating unit tests
- Refactoring functions or methods

## Highlight code and activate

Highlight the block of code you would like to modify, and press `cmd/ctrl + i` to activate the edit input.

## Describe code changes

Describe the changes you would like the model to make to your highlighted code. For edits, a good prompt should be relatively short and concise. For longer, more complex tasks, we recommend using [Chat](chat/how-to-use-it.md).

## Accept or reject changes

Proposed changes appear as inline diffs within your highlighted text.

You can navigate through each proposed change, accepting or rejecting them using `cmd/ctrl + opt + y` (to accept) or `cmd/ctrl + opt + n` (to reject).

You can also accept or reject all changes at once using `cmd/ctrl + shift + enter` (to accept) or `cmd/ctrl + shift + delete` (to reject).

If you want to request a new suggestion for the same highlighted code section, you can use `cmd/ctrl + i` to re-prompt the model.
