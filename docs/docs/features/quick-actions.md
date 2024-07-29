---
title: Quick Actions (experimental, VS Code only)
description: Quick Actions streamline your development workflow by allowing quick edits on selected classes or functions
keywords: [experimental, automate, configuration]
toc_max_heading_level: 5
---

## Quick Actions (experimental, VS Code only)

Quick Actions streamline your development workflow by providing a tool to quickly select an entire class or function to perform a quick edit on. Configure custom actions to execute complex operations with a single click.

![Quick actions example](/img/quick-actions-demo.gif)

## How It Works

:::info[Note]
For the language of the file you have open, you must have the Language Server Protocol extension installed.
:::

Quick Actions use a CodeLens provider to add interactive elements above functions and classes in your code.

By default, Quick Actions include a single predefined action:

- `Continue`: This action allows you to perform a quick edit on the selected class or function.

## How to disable Quick Actions

Quick Actions are enabled by default _for pre-release versions of Contine_.

To disable Quick Actions, open the settings menu (`⌘ + ,`), search for `"continue.enableQuickActions"`, and toggle the checkbox to disable.

## Custom Quick Actions

Custom Quick Actions allow you to tailor functionality to your specific needs, extending beyond the default actions. You can easily configure these custom actions in your `~/.continue/config.json` file.

:::info
[View the Configuration Options reference](../reference/config) for specific schema details.
:::

### Example Use Cases

#### 1. Write an inline unit test

A quick action that generates and inserts a unit test above the selected code.

```json title=~/.continue/config.json
"experimental": {
    "quickActions": [
      {
        "title": "Unit test",
        "prompt": "Write a unit test for this code. Do not change anything about the code itself.",
      }
    ]
  }
```

#### 2. Send code to chat panel to learn more about it

The default "Explain" aims to provide a brief overview of the code. This quick action sends the prompt and the code to the chat to provides a more detailed explanation.

```json title=~/.continue/config.json
"experimental": {
    "quickActions": [
      {
        "title": "Detailed explanation",
        "prompt": "Explain the following code in detail, including all methods and properties.",
        "sendToChat": true
      }
    ]
  }
```

#### 3. Create a Typescript interface

A quick action that generates and inserts a Typescript interface above the selected code.

```json title=~/.continue/config.json
"experimental": {
    "quickActions": [
      {
        "title": "Create Interface",
        "prompt": "Create a new Typescript interface for the following code.",
      }
    ]
  }
```

## Share your feedback

We'd love to hear your thoughts on Quick Actions! Share your feedback and help us improve.

<!-- Discord Feedback channel -->

<a href="https://discord.com/channels/1108621136150929458/1156679146932535376" className="button button--primary">Give Feedback on Discord</a>
