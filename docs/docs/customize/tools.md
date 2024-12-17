---
title: Tools
description: Tool use and customization
keywords: [tool, use, function calling, claude, automatic]
---

Tools allow Continue to take action in your IDE and beyond (when you give permission). Currently, they are only supported with [Anthropic](./model-providers/top-level/anthropic.md). To use tools, click on the icon in the input toolbar like below.

![tools](/img/tool-use-example.png)

To let you balance speed and safety, each tool can be set to 1 of 3 modes:

- `Automatic`: When the LLM requests to use the tool, Continue will automatically call it and send the response to the LLM.
- `Allowed`: When the LLM requests to use the tool, Continue will first give you the opportunity to "Cancel" or "Continue" with the tool.
- `Disabled`: The LLM will not know about or be able to use the tool.

### Custom tools

Currently custom tools can be configured using the [Model Context Protocol](https://modelcontextprotocol.io/introduction), a standard proposed by Anthropic to unify prompts, context, and tool use. Read their [quickstart](https://modelcontextprotocol.io/quickstart) to learn how to set up a local server and then configure your `config.json` like this:

```json title="~/.continue/config.json"
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-sqlite", "--db-path", "/Users/NAME/test.db"]
        }
      }
    ]
  }
}
```
