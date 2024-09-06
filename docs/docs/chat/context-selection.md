---
title: Context selection
description: How context can be selected for Chat
keywords: [context]
---

## Input

Typing a question or instructions into the input box is the only required context. All of the other methods to select and include additional context listed below are optional.

## Highlighted code

The highlighted code you’ve selected by pressing `cmd/ctrl + L` will be included in your prompt alongside the input you provide. This is the only section of code that will be provided to the model unless you highlight additional sections or use one of the other selection methods below.

## Active file

You can include the currently open file as context by pressing `cmd/ctrl + opt + enter` when you send your request.

## Specific file

You can include a specific file in your current workspace as context by typing `@files` and selecting the file.

## Specific folder

You can include a folder in your current workspace as context by typing `@directory` and selecting the directory. It works like `@codebase` but only includes the files in the selected directory.

## Entire codebase

You can include your entire codebase as context by typing `@codebase`. Learn more about how it works here.

## Documentation site

You can include a documentation site as context by typing `@docs` and selecting the documentation site. Learn more about how it works here.

## Terminal contents

You can include the contents of the terminal in your IDE as context by typing `@terminal`.

## Git diff

You can include all of the changes you've made to your current branch by typing `@diff`.

## Other context

Go to reference to see giant list of context providers
