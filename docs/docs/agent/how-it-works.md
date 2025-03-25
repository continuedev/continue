---
title: How it works
description: How Agent works
keywords: [how, agent, works]
sidebar_position: 4
---

Agent offers all the functionality of chat, while also including tools in the request to the model and an interface for handling tool calls and responses.

## Built-In Tools

Continue includes several built-in tools which provide the model access to IDE functionality:

- **Read File**: read the contents of a file within the project
- **Read Currently Open File**: read the contents of the currently open file
- **Create New File**: Create a new file within the project, with path and contents specified by the model
- **Exact Search**: perform a `ripgrep` search within the project
- **Run Terminal Command**: run a terminal command from the workspace root
- **Search Web**: Perform a web search to get top results
- **View Diff**: View the current working git diff
- **View Repo Map**: request a copy of the repository map - same as the [Repo Map Context Provider](../customize/context-providers.mdx#repository-map)
- **View Subdirectory**: request a copy of a repo map for a specific directory within the project

When Agent is turned off, tools are not included in the request to the model.

## Model Support

![agent mode not supported](/img/mode-select-agent-not-supported.png)

<!--
:::
Using tools is typically much more expensive than exluding them - TODO add a note like this somewhere
::: -->
