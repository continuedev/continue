---
title: Chat
description: How to use Chat
sidebar_label: How to use it
keywords: [how, use, chat]
sidebar_position: 1
---

![chat](/img/chat.gif)

## How to use it

Chat makes it easy to ask for help from an LLM without needing to leave the IDE. You send it a task, including any relevant information, and it replies with the text / code most likely to complete the task. If it does not give you what you want, then you can send follow up messages to clarify and adjust its approach until the task is completed.

Chat is best used to understand and iterate on code or as a replacement for search engine queries.

## Type a request and press enter

You send it a question, and it replies with an answer. You tell it to solve a problem, and it provides you a solution. You ask for some code, and it generates it.

## Highlight a code section to include as context

You select a code section with your mouse, press <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) to send it to the LLM, and then ask for it to be explained to you or request it to be refactored in some way.

## Reference context with the @ symbol

If there is information from the codebase, documentation, IDE, or other tools that you want to include as context, you can type @ to select and include it as context. You can learn more about how to use this in [Chat context selection](context-selection.md).

## Apply generated code to your file

When the LLM replies with edits to a file, you can click the “Apply” button. This will update the existing code in the editor to reflect the suggested changes.

## Start a fresh session for a new task

Once you complete a task and want to start a new one, press <kbd>cmd/ctrl</kbd> + <kbd>L</kbd> (VS Code) or <kbd>cmd/ctrl</kbd> + <kbd>J</kbd> (JetBrains) to begin a new session, ensuring only relevant context for the next task is provided to the LLM.

## Switch between different models

If you have configured multiple models, you can switch between models using the dropdown or by pressing <kbd>cmd/ctrl</kbd> + <kbd>’</kbd>
