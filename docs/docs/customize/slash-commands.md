---
title: Slash commands
description: Shortcuts that can be activated by prefacing your input with '/'
keywords: [slash command, custom commands, step]
---

Slash commands are shortcuts that can be activated by typing '/' and selecting from the dropdown. For example, the built-in '/edit' slash command lets you stream edits directly into your editor.

![slash-commands](/img/slash-commands.png)

## Built-in Slash Commands

To use any of the built-in slash commands, open `config.json` and add it to the `slashCommands` list.

### `/Edit`

Select code with `ctrl/cmd + L` (VS Code) or `ctrl/cmd + J` (JetBrains), and then type `/Edit`, followed by instructions for the edit. Continue will stream the changes into a side-by-side diff editor.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "edit",
      "description": "Edit highlighted code"
    }
  ]
}
```

### `/Comment`

Comment works just like `/Edit`, except it will automatically prompt the LLM to comment the code.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "comment",
      "description": "Write comments for the highlighted code"
    }
  ]
}
```

### `/Share`

Generate a shareable markdown transcript of your current chat history.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "share",
      "description": "Export the current chat session to markdown",
      "params": { "outputDir": "~/.continue/session-transcripts" }
    }
  ]
}
```

Use the `outputDir` parameter to specify where you want to the markdown file to be saved.

### `/Cmd`

Generate a shell command from natural language and (only in VS Code) automatically paste it into the terminal.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "cmd",
      "description": "Generate a shell command"
    }
  ]
}
```

### `/Commit`

Shows the LLM your current git diff and asks it to generate a commit message.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "commit",
      "description": "Generate a commit message for the current changes"
    }
  ]
}
```

### `/Http`

Write a custom slash command at your own HTTP endpoint. Set 'url' in the params object for the endpoint you have setup. The endpoint should return a sequence of string updates, which will be streamed to the Continue sidebar. See our basic [FastAPI example](https://github.com/continuedev/continue/blob/74002369a5e435735b83278fb965e004ae38a97d/core/context/providers/context_provider_server.py#L34-L45) for reference.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "http",
      "description": "Does something custom",
      "params": { "url": "<my server endpoint>" }
    }
  ]
}
```

### `/Issue`

Describe the issue you'd like to generate, and Continue will turn into a well-formatted title and body, then give you a link to the draft so you can submit. Make sure to set the URL of the repository you want to generate issues for.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "issue",
      "description": "Generate a link to a drafted GitHub issue",
      "params": { "repositoryUrl": "https://github.com/continuedev/continue" }
    }
  ]
}
```

### `/Onboard`

The Onboard slash command helps to familiarize yourself with a new project by analyzing the project structure, READMEs, and dependency files. It identifies key folders, explains their purpose, and highlights popular packages used. Additionally, it offers insights into the project's architecture.

```json title="config.json"
{
  "slashCommands": [
    {
      "name": "onboard",
      "description": "Familiarize yourself with the codebase"
    }
  ]
}
```
