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

You can include a specific file in your current workspace as context by typing [`@Files`](../customize/context-providers.mdx#file) and selecting the file.

## Specific folder

You can include a folder in your current workspace as context by typing [`@Folder`](../customize/context-providers.mdx#folder) and selecting the directory. It [works like `@Codebase`](../customize/deep-dives/codebase.mdx) but only includes the files in the selected folder.

## Codebase search

You can automatically include relevant files from your codebase as context by typing [`@Codebase`](../customize/context-providers.mdx#codebase). You can learn about how @Codebase works [here](../customize/deep-dives/codebase.mdx).

## Documentation site

You can include a documentation site as context by typing [`@Docs`](../customize/context-providers.mdx#docs) and selecting the documentation site. You can learn about how @Docs works [here](../customize/deep-dives/docs.mdx).

## Terminal contents

You can include the contents of the terminal in your IDE as context by typing [`@Terminal`](../customize/context-providers.mdx#terminal).

## Git diff

You can include all of the changes you've made to your current branch by typing [`@Git Diff`](../customize/context-providers.mdx#git-diff).

## Other context

You can see a full list of built-in context providers [here](../customize/context-providers.mdx) and how to create your own custom context provider [here](../customize/tutorials/build-your-own-context-provider.mdx).
