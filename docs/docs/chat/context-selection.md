---
title: Context selection
description: How context can be selected for Chat
keywords: [context]
sidebar_position: 3
---

## Input

Typing a question or instructions into the input box is the only required context. All of the other methods to select and include additional context listed below are optional.

## Highlighted code

The highlighted code you’ve selected by pressing <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) will be included in your prompt alongside the input you provide. This is the only section of code that will be provided to the model unless you highlight additional sections or use one of the other selection methods below.

## Active file

You can include the currently open file as context by pressing <kbd>opt</kbd> + <kbd>enter</kbd> (Mac) or <kbd>alt</kbd> + <kbd>enter</kbd> (Windows) when you send your request at Chat window(Prompt can't be empty).

## Specific file

You can include a specific file in your current workspace as context by typing [`@Files`](../advanced/context-integration/custom-providers#file) and selecting the file.

## Specific folder

You can include a folder in your current workspace as context by typing [`@Folder`](../advanced/context-integration/custom-providers#folder) and selecting the directory. It [works like `@Codebase`](../advanced/deep-dives/codebase.mdx) but only includes the files in the selected folder.

## Codebase search

You can automatically include relevant files from your codebase as context by typing [`@Codebase`](../advanced/context-integration/custom-providers#codebase). You can learn about how @Codebase works [here](../advanced/deep-dives/codebase.mdx).

## Documentation site

You can include a documentation site as context by typing [`@Docs`](../advanced/context-integration/custom-providers#docs) and selecting the documentation site. You can learn about how @Docs works [here](../advanced/deep-dives/docs.mdx).

## Terminal contents

You can include the contents of the terminal in your IDE as context by typing [`@Terminal`](../advanced/context-integration/custom-providers#terminal).

## Git diff

You can include all of the changes you've made to your current branch by typing [`@Git Diff`](../advanced/context-integration/custom-providers#git-diff).

## Other context

You can see a full list of built-in context providers [here](../advanced/context-integration/custom-providers) and how to create your own custom context provider [here](../advanced/tutorials/build-your-own-context-provider.mdx).
