### Other triggers for Actions (VS Code)

:::info
Currently all of these are only available in VS Code
:::

To make common use cases even more accessible, we provide a handful of other ways to invoke actions.

#### Quick actions

Quick Actions are displayed as buttons above top-level classes and functions in your source code, letting you invoke actions with one click. They can also be customized with .prompt files to perform custom actions.

![quick-actions](/img/quick-actions.png)

By default, quick actions are disabled, but can be enabled with the “Continue: Enable Quick Actions” in VS Code settings.

#### Right click actions

Right click actions let you highlight a desired region of code, right click, and then select an action from the dropdown menu.

![context-menu](/img/context-menu.png)

#### Debug action

The debug action is a special built-in keyboard shortcut in the VS Code extension. Use <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>R</kbd> to instantly copy the contents of the current terminal into the chat sidebar and get debugging advice.

#### Quick fixes

Whenever you see red/yellow underlines in your code indicating errors, you can place your cursor nearby and VS Code will display a lightbulb icon. Either clicking the lightbulb or using the keyboard shortcut <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> will show a dropdown menu of quick fixes. One of these will be the “Ask Continue” action. Either click or use <kbd>cmd/ctrl</kbd> + <kbd>.</kbd> again and Continue will attempt to help solve the problem.

![ask-continue](/img/ask-continue.png)

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

Right click actions that generate inline diffs, use the same prompt and response processing logic as [Edit](../edit/how-it-works.md).
