---
title: How to customize
description: How to customize Chat
keywords: [customize, chat]
sidebar_position: 5
---

## Add MCP tools

You can add MCP servers to your assistant to give Agent access to more tools. [Explore MCP Servers on the Hub](https://hub.continue.dev/explore/mcp) and see the [MCP guide](../customize/deep-dives/mcp.mdx) for more details.

## Tool policies

You can adjust Agent's usage behavior for each tool in your assistant to one of these options:

- **Ask First (default)** - request permission from the user; show the `Cancel` and `Continue` buttons
- **Automatic** - do not request permission, automatically call the tool and feed the response back to the model
- **Excluded** - do not send this tool to the model

:::warning
Be careful setting any tools to `automatic` if their behavior is not read-only.
:::

First, open `Tool Policies` by clicking the tools icon in the input toolbar

![Input Toolbar](/img/lump-toolbar.png)

Then, you can view and change tool policies. To change a policy, click on the policy text ("Excluded", etc.) to toggle it. You can also turn groups of tools (e.g. all Built-in tools or all tools from a specific MCP server) off using the section toggles.

![Tool Policies](/img/tool-policies.png)

Tool policies are stored locally per user.