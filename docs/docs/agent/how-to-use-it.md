---
title: Agent
description: How to use Agent
sidebar_label: How to use it
keywords: [how, use, agent]
sidebar_position: 1
---

![agent mode](/img/agent.gif)

## How to use it

Agent uses tools to unlock the power of the IDE for your model, allowing the model to make decisions and save you the work of manually finding context and performing actions.

## Enable Agent

To enable Agent, use the Mode selector below the chat input to select `Agent`.

![selecting agent mode](/img/mode-select-agent.png)

:::info
If Agent is disabled with a `Not Supported` message, the selected model/provider doesn't support tools, or Continue doesn't yet support tools with it. See [Tool Support](../customize/tools.mdx#tool-support)
:::

## Chat with Agent

Agent lives within the same interface as [Chat](../chat/how-it-works.md), so the same [input](../chat/how-to-use-it.md#type-a-request-and-press-enter) is used to send messages and you can still use the same manual methods of providing context, such as [`@` context providers](../chat/how-to-use-it.md#reference-context-with-the--symbol) or adding [highlighted code from the editor](../chat/how-to-use-it.md#highlight-a-code-section-to-include-as-context).

### Use natural language

With Agent, you can use more natural language and let the model do the work. As an example, you might say:

> Set the @typescript-eslint/naming-convention rule to "off" for all eslint configurations in this project

Then, Agent can decide which tools to use to get the job done.

## Give Agent Permission

By default, Agent will ask permission when it wants to use a tool. Click `Continue` to allow Agent to proceed with the tool call, or `Cancel` to reject it.

![agent requesting permission](/img/agent-permission.png)

You can use tool policies to exclude or make usage automatic for specific tools. See [How to Customize](./how-to-customize.md).

## View Tool Responses

Data returned from tools calls is fed back to the model as context item(s). Most errors are also caught and returned to Agent so that it can decide how to proceed.

![agent response](/img/agent-response.png)
