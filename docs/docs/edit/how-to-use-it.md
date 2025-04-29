---
title: Edit
sidebar_position: 1
sidebar_label: How to use it
description: How to use Edit
keywords: [edit, cmd l, use]
---

![edit](/img/edit.gif)

## How to use it

Edit is a convenient way to make quick changes to specific code and files. Select code, describe your code changes, and a diff will be streamed inline to your file which you can accept or reject.

Edit is recommended for small, targeted changes, such as

- Writing comments
- Generating unit tests
- Refactoring functions or methods

## Highlight code and activate

Highlight the block of code you would like to modify and press <kbd>cmd/ctrl</kbd> + <kbd>i</kbd> to active Edit mode. You can also enter Edit mode by pressing <kbd>cmd/ctrl</kbd> + <kbd>i</kbd> with no code highlighted.

## Describe code changes

Describe the changes you would like the model to make to your highlighted code. For edits, a good prompt should be relatively short and concise. For longer, more complex tasks, we recommend using [Chat](../chat/how-to-use-it.md).

## Accept or reject changes

Proposed changes appear as inline diffs within your highlighted text.

You can navigate through each proposed change, accepting or rejecting them using <kbd>cmd/ctrl</kbd> + <kbd>opt</kbd> + <kbd>y</kbd> (to accept) or <kbd>cmd/ctrl</kbd> + <kbd>opt</kbd> + <kbd>n</kbd> (to reject).

You can also accept or reject all changes at once using <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>enter</kbd> (to accept) or <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>delete/backspace</kbd> (to reject).

If you want to request a new suggestion for the same highlighted code section, you can use <kbd>cmd/ctrl</kbd> + <kbd>i</kbd> to re-prompt the model.

## VS Code

In VS Code, Edit is implemented in the extension sidebar with a similar interface to [Chat](../chat/how-it-works.md), and you can also enter Edit mode by using the Mode Selector below the main Chat input to select `Edit`.

![edit mode selected](/img/select-edit-mode.png)

You can also reject and accept diffs using the `Reject All` and `Accept All` buttons that show up in the Chat when diffs are present (see examples below).

### Adding Code to Edit

Along with adding highlighted code, you can also manually add files to edit using the `Add file` combobox or by clicking the dropdown and selecting `Add all open files` to add all files that are currently open in the editor.

**_Add file combobox_**

![edit mode add file combobox](/img/edit-mode-add-files.png)

**_Add all open files dropdown_**

![edit mode add file combobox](/img/edit-mode-add-all-open-files.png)

### Single File Edit

If one file/range is present in `Code to Edit` on submission, Continue will prompt the Edit model and then automatically stream the diff into the editor.

![Edit mode single file diffs](/img/edit-mode-single-file-diff.png)

### Multi-File Edit

If multiple files/ranges are present in `Code to Edit` on submission, Continue will prompt the Edit model to output codeblocks per-file, which the user can then choose to apply and accept/reject independently.

**_Generated Content_**

![Edit mode multi file generated content](/img/edit-mode-multi-file-generation.png)

**_Diffs_**

![Edit mode multi file diffs](/img/edit-mode-multi-file-diffs.png)

## Jetbrains

In Jetbrains, Edit is implemented as an inline popup (see the header GIF example) for single-file edit. Multi-file edit mode is not currently implemented.
