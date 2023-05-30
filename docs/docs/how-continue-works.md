# How `Continue` works

*TODO: Describe in more detail how `Continue` works*

The `Continue` library consists of a [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Core](./concepts/core.md) that brings everything together.

The [SDK](./concepts/sdk.md) gives you access to tools (e.g. open a directory, edit a file, call a model, etc), which you can use when defining how a step should work and composing them with other steps.

The [GUI](./concepts/gui.md) enables you to guide steps and makes everything transparent, so you can review all steps that were automated, giving you the opportunity to undo and rerun any that ran incorrectly.

The [Core](./concepts/core.md) connects the SDK and GUI with the IDE (i.e. in VS Code, a web browser, etc), enabling the steps to make changes to your code and accelerate your software development workflows.