---
title: How Continue works
description: Overview of the Continue archictecture
keywords: [architecture, vs code, jetbrains, ide, manually]
---


# ⚙️ How Continue works

![Continue Architecture Diagram](/img/continue-diagram.png)

## Overview

- Continue is typically used inside of an Integrated Development Environment (IDE) like VS Code or JetBrains
- All units of action in Continue are called steps. Steps can be recursively composed into more complex steps
- Steps have access to the SDK, which enables you to use LLMs in your workflows (e.g. edit a file, call a model, etc)
- The Server facilitates communication between the IDE and the GUI and determines what steps to take next
- The GUI enables you to review every automated step, giving you the opportunity to undo and rerun any or all
- It is also possible to run Continue in headless, asynchronous mode. Please reach out if you are interested in this!

## Supported IDEs

### VS Code (Beta)

Continue can be used as a VS Code extension.

You can install it from the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

### JetBrains (Alpha)

Continue can be used as a plugin inside of Intellij, PyCharm, WebStorm, etc.

You can install it from the JetBrains Marketplace [here](https://plugins.jetbrains.com/plugin/22707-continue-extension).

### Add Continue to a new IDE

Here is how you can get started with adding Continue to a new IDE:

1. Let us know that you would like to add Continue to a new IDE by opening an issue [here](https://github.com/continuedev/continue/issues/new/choose)
2. Implement a class that maps each of the actions like "read file" to the API provided by that IDE like [here](https://github.com/continuedev/continue/blob/main/extension/src/continueIdeClient.ts)
3. Learn more about what you might also do by looking at this pull request that added initial support for JetBrains [here](https://github.com/continuedev/continue/pull/457)

## Running the server manually

If you would like to run the Continue server manually, rather than allowing the IDE to automatically set it up, you can follow the short tutorial for [Manually Running Continue](./walkthroughs/manually-run-continue.md).