---
title: How it works
description: How Agent works
keywords: [how, agent, works]
sidebar_position: 4
---

Agent offers the same functionality as Chat, while also including tools in the request to the model and an interface for handling tool calls and responses.

## The tool handshake

Tools provide a flexible, powerful way for models to interface with the external world. They are provided to the model as a JSON object with a name and an arguments schema. For example, a `read_file` tool with a `filepath` argument will give the model the ability to request the contents of a specific file.

The following handshake describes how Agent uses tools:

1. In Agent mode, available tools are sent along with `user` chat requests
2. The model can choose to include a tool call in its response
3. The user gives permission. This step is skipped if the policy for that tool is set to `Automatic`
4. Continue calls the tool using built-in functionality or the MCP server that offers that particular tool
5. Continue sends the result back to the model
6. The model responds, potentially with another tool call and step 2 begins again

:::info
In [Chat mode](../chat/how-to-use-it.md), tools are **not** included in the request to the model.
:::

## Built-in tools

Continue includes several built-in tools which provide the model access to IDE functionality:

- **Read file** (`builtin_read_file`): read the contents of a file within the project
- **Read currently open file** (`builtin_read_currently_open_file`): read the contents of the currently open file
- **Create new file** (`builtin_create_new_file`): Create a new file within the project, with path and contents specified by the model
- **Exact search** (`builtin_exact_search`): perform a `ripgrep` search within the project
- **Run terminal command** (`builtin_run_terminal_command`): run a terminal command from the workspace root
- **Search web** (`builtin_search_web`): Perform a web search to get top results
- **View diff** (`builtin_view_diff`): View the current working git diff
- **View repo map** (`builtin_view_repo_map`): request a copy of the repository map—same as the [Repo Map Context Provider](../customize/context-providers.mdx#repository-map)
- **View subdirectory** (`builtin_view_subdirectory`): request a copy of a repo map for a specific directory within the project
- **Create Rule Block** (`builtin_create_rule_block`): creates a new rule block in `.continue/rules` based on the contents of the conversation
