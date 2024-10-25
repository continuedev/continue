---
title: Context selection
description: Actions \-context selection
keywords: [context, slash, debug, quick fix, right click]
sidebar_position: 3
---

## Slash commands

Slash commands can be combined with additional instructions, including [context providers](chat/context-selection.md) or [highlighted code](chat/context-selection.md).

For example, with the “/edit” slash command you should describe the edit that you want the LLM to perform.

Some slash commands will not acknowledge your input; for example, the “/share” slash command just creates a markdown copy of the current conversation, regardless of what else you may request it to do.

## Quick actions

Quick actions are always displayed above a class or function and will edit that class or function, but nothing outside of it.

## Right click actions

The highlighted code you’ve selected will be included in your prompt alongside a pre-written set of instructions depending on the selected action. This is the only section of code that the model will attempt to edit.

## Debug action

The debug action selects the most recently run terminal command and its output and then injects the following prompt into the chat window. There is no additional, non-visible information sent to the language model.

```
I got the following error, can you please help explain how to fix it?

[ERROR_MESSAGE]
```

## Quick fixes

Similarly to the debug action, quick actions transparently inject a prompt into the chat window. When you select “Ask Continue”, the 3 lines above and below the error are sent to the chat followed by the question “How do I fix the following problem in the above code?: [ERROR_MESSAGE]”.
