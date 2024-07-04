---
toc_max_heading_level: 5
---

# Quick Actions (experimental)

Quick Actions automate repetitive tasks and streamline your development workflow. Configure custom actions to execute complex operations with a single click.

:::info[Note]
Quick Actions are currently only available in VSCode.
:::

## How It Works

Quick Actions use a CodeLens provider to add interactive elements above functions and classes in your code.

By default, Quick Actions include two predefined actions:

1. Explain: This action provides an explanation of the selected code.
2. Create Docstring Comment: This action generates a docstring comment for the selected function or class.

![Quick actions example](/img/quick-actions-example.png)

## How to enable Quick Actions

Quick Actions are currently disabled by default.

To enable Quick Actions, open the settings menu (⌘ + ,), search for "continue.enableQuickActions", and toggle the checkbox to activate.

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
        "prompt": "Write a unit test for this code",
      }
    ]
  }
```

#### 2. Explain the code in more detail

The default "Explain" aims to provide a brief overview of the code. This quick action sends the prompt and the code to the chat to provides a more detailed explanation.

```json title=~/.continue/config.json
"experimental": {
    "quickActions": [
      {
        "title": "Detailed explanation",
        "prompt": "Explain the following code in detail, inlcuding all methods and properties",
        "sendToChat": true
      }
    ]
  }
```

#### 3. Tell me a strory about this code

A quick action that sends a prompt to the chat panel to tell a story about the selected code.

```json title=~/.continue/config.json
"experimental": {
    "quickActions": [
      {
        "title": "Storytime",
        "prompt": "Tell me a story about this code",
        "sendToChat": true
      }
    ]
  }
```

## Share your feedback

We'd love to hear your thoughts on Quick Actions! Share your feedback and help us improve.

<!-- Discord Feedback channel -->

<a href="https://discord.com/channels/1108621136150929458/1156679146932535376" className="button button--primary">Give Feedback on Discord</a>
