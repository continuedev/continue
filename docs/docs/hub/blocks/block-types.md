---
title: Block Types
description: Overview of different block types.
keywords: [blocks, types, overview]
sidebar_label: Types
---

# Block Types

## Models

Models are blocks that let you specify Large Language Models (LLMs) and other deep learning models to be used in different affordances like Chat, Autocomplete, Edit, @Codebase, and @Docs.

Models can have one or more of the following roles depending on its capabilities: chat, edit, autocomplete, embed, rerank, and apply.

View [`models`](../../yaml-reference.md#models) in the YAML Reference for more details.

## Context

Context are blocks that define a context provider which can be referenced in Chat with @ to pull in data from external sources like Jira or Confluence.

The list of possible context providers can be found here. If you want to create a custom context provider, you will want to use the "http" context provider to call a server that hosts your own code and returns the context requested as described here.

View [`context`](../../yaml-reference.md#context) in the YAML Reference for more details.

## Docs

Docs are blocks that point to documentation sites, which @Docs indexes locally for you to reference as context when using Chat. Read more in the [@Docs deep dive](../../customize/deep-dives/docs.mdx)

View [`docs`](../../yaml-reference.md#docs) in the YAML Reference for more details.

## Tools

View [`tools`](../../yaml-reference.md#tools) in the YAML Reference for more details.

## MCP Servers

Model Context Protocol (MCP) servers are blocks that define a standard way of building and sharing tools for language models.

You can read more about MCP in Continue here and MCP in general here.

View [`mcpServers`](../../yaml-reference.md#mcpservers) in the YAML Reference for more details.

## Rules

Rules are blocks with instructions that your custom AI code assistant will always follow (i.e. its contents will be inserted into the system message for all Chat requests)

You can read more in the [.continuerules deep dive](../../customize/deep-dives/rules.md). The one difference is that when you use rules in an assistant created on the hub, the rules are not placed in the root of your project.

View [`rules`](../../yaml-reference.md#rules) in the YAML Reference for more details.

## Prompts

Prompts are blocks with pre-written model prompts that let you invoke complex instructions with a slash command in Chat.

You can read more in the prompt files deep dive. There are a couple differences when you use prompts in an assistant created on the hub:

1. the prompts are not placed in the `.continue/prompts` project directory and
2. you can only use prompts via slash commands.

View [`prompts`](../../yaml-reference.md#prompts) in the YAML Reference for more details.

## Data

Data blocks allow you send your development data to custom destinations of your choice. Development data is used for a variety of purposes, including analyzing usage, gethering insights, or fine-tuning models. You can read more about development data [here](../../customize/development-data.md).

Data destinations are configured in the[`data`](../../yaml-reference.md#data) section of `config.yaml`.
