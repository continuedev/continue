---
title: How it works
description: How Chat works
keywords: [how, chat, works]
sidebar_position: 4
---

Using any selected code sections, all context that you have selected with @, and your input instructions, we prompt the model to provide a response in the sidebar. If you are asking a follow-up, then the all earlier session context is also included. No other additional context is provided to the model.

The model response is then streamed directly back to the sidebar. Each code section included in the response will be placed into its own code block, which gives you buttons to either “Apply to current file”, “Insert at cursor”, or “Copy” for each section.

When you press cmd+L at the end of a session, all context is cleared and a new session is started, so that you can begin a new task. If you would like to view the exact prompt that is sent to the model during Chat, you can [view this in the prompt logs](../reference/).

:::info
TODO: You can learn about how @codebase and how @docs work here and here
:::
