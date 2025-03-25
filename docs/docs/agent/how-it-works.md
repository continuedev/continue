---
title: How it works
description: How Agent works
keywords: [how, agent, works]
sidebar_position: 4
---

Agent offers all the functionality of chat, while also including tools in the request to the model and an interface for handling tool calls and responses.

## The Tool Handshake

Tools provider a flexible, powerful way for models to interface with custom/external functionality. They are sent to the model as a JSON object with a name and arguments schema. For example, a `read_file` tool with a `filepath` argument will give the model the ability to request the contents of a specific file. The following handshake describes how Agent uses tools.

1. In Agent mode, available tools are sent along with `user` chat requests.
2. The model can choose to include a Tool Call in its response
3. The user gives permission. This step is skipped if the tool's policy is set to `automatic`, see [How to Customize](./how-to-customize.md)
4. Continue calls the tool using built-in functionality or the MCP server it came from
5. Continue sends the result back to the model
6. The model responds, potentially with another tool call (back to step 2)

:::info
In [Chat mode](../chat/how-to-use-it.md), tools are **not** included in the request to the model.
:::

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
