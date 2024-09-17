---
title: Context selection
description: Autocomplete context selection
keywords: [context, autocomplete, lsp, recent]
sidebar_position: 3
---

Autocomplete will automatically determine context based on the current cursor position. We use the following techniques to determine what to include in the prompt:

### File prefix/suffix

We will always include the code from your file prior to and after the cursor position.

### Definitions from the Language Server Protocol

Similar to how you can use `cmd/ctrl + click` in your editor, we use the same tool (the LSP) to power "go to definition". For example, if you are typing out a function call, we will include the function definition. Or, if you are writing code inside of a method, we will include the type definitions for any parameters or the return type.

### Imported files

Because there are often many imports, we can't include all of them. Instead, we look for symbols around your cursor that have matching imports and use that as context.

### Recent files

We automatically consider recently opened or edited files and include snippets that are relevant to the current completion.
