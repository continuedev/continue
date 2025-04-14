---
title: VS Code Actions
description: VS Code Actions
keywords: [vscode, quick actions, quick, actions]
---

### Other triggers for Actions (VS Code)

:::info
Currently all of these are only available in VS Code
:::

To make common use cases even more accessible, we provide a handful of other ways to invoke actions in VS Code.

## Quick actions

Quick Actions are displayed as buttons above top-level classes and functions in your source code, letting you invoke actions with one click. They will edit that class or function, but nothing outside of it. They can also be customized with [.prompt files](./prompts.md) to perform custom actions.

![quick-actions](/img/quick-actions.png)

By default, quick actions are disabled, but can be enabled with the “Continue: Enable Quick Actions” in VS Code settings.

## Right click actions

Right click actions let you highlight a desired region of code, right click, and then select an action from the dropdown menu.

The highlighted code you’ve selected will be included in your prompt alongside a pre-written set of instructions depending on the selected action. This is the only section of code that the model will attempt to edit.

Right click actions that generate inline diffs use the same prompt and response processing logic as [Edit](../../edit/how-it-works.md).

![context-menu](/img/context-menu.png)

## Debug action

The debug action is a special built-in keyboard shortcut in the VS Code extension. Use <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>R</kbd> to instantly copy the contents of the most recent terminal output into the chat sidebar and get debugging advice. There is no additional, non-visible information sent to the language model.

```
I got the following error, can you please help explain how to fix it?

[ERROR_MESSAGE]
```

## Quick fixes

Whenever you see red/yellow underlines in your code indicating errors, you can place your cursor nearby and VS Code will display a lightbulb icon. Either clicking the lightbulb or using the keyboard shortcut <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> will show a dropdown menu of quick fixes. One of these will be the “Ask Continue” action. Either click or use <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> again and Continue will attempt to help solve the problem.

Similarly to the debug action, quick actions transparently inject a prompt into the chat window. When you select “Ask Continue”, the 3 lines above and below the error are sent to the chat followed by the question “How do I fix the following problem in the above code?: [ERROR_MESSAGE]”.

![ask-continue](/img/ask-continue.png)
