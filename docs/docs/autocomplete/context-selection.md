---
title: Context selection
description: Autocomplete \-context selection
keywords: [context]
---

Autocomplete will automatically determine context based on the current cursor position. We use the following techniques to determine what to include in the prompt:

### File prefix/suffix

We will always include the code from your file prior to and after the cursor position.

### Type definitions from the LSP

### Recent files

We automatically consider recently opened or edited files and include snippets that are relevant to the current completion.
