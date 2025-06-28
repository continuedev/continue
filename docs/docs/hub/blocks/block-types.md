---
title: Block Types
description: Overview of different block types
keywords: [blocks, types, overview]
sidebar_label: Types
---

# Block Types

## Models

Models are blocks that let you specify Large Language Models (LLMs) and other deep learning models to be used for various roles in the open-source IDE extension like Chat, Autocomplete, Edit, Embed, Rerank, etc. You can explore available models on [the hub](https://hub.continue.dev/explore/models).

Continue supports [many model providers](../../advanced/model-providers), including Anthropic, OpenAI, Gemini, Ollama, Amazon Bedrock, Azure, xAI, DeepSeek, and more. Models can have one or more of the following roles depending on its capabilities, including `chat`, `edit`, `apply`, `autocomplete`, `embed`, and `rerank`. Read more about roles [here](../../advanced/model-roles). View [`models`](../../advanced/reference#models) in the YAML Reference for more details.

## Context

Context blocks define a context provider which can be referenced in Chat with `@` to pull in data from external sources such as files and folders, a URL, Jira or Confluence, and GitHub issues, among others. [Explore context provider blocks](https://hub.continue.dev/explore/context) on the hub.

Learn more about context providers [here](../../advanced/reference#context), and check out [this guide](../../advanced/tutorials/build-your-own-context-provider.mdx) to creating your own custom context provider. The `config.yaml` spec for context can be found [`here`](../../advanced/reference#context).

## Docs

Docs are blocks that point to documentation sites, which will be indexed locally and then can be referenced as context using @Docs in Chat. [Explore docs](https://hub.continue.dev/explore/docs) on the hub.

Learn more in the [@Docs deep dive](../../advanced/deep-dives/docs.mdx), and view [`docs`](../../advanced/reference#docs) in the YAML Reference for more details.

## MCP Servers

Model Context Protocol (MCP) is a standard way of building and sharing tools for language models. MCP Servers can be defined in `mcpServers` blocks. [Explore MCP Servers](https://hub.continue.dev/explore/mcp) on the hub.

Learn more in the [MCP deep dive](../../advanced/deep-dives/mcp.mdx), and view [`mcpServers`](../../advanced/reference#mcpservers) in the YAML Reference for more details.

## Rules

Rules blocks are instructions that your custom AI code assistant will always keep in mind - the contents of rules are inserted into the system message for all Chat requests. [Explore rules](https://hub.continue.dev/explore/rules) on the hub.

Learn more in the [rules deep dive](../../advanced/deep-dives/rules.mdx), and view [`rules`](../../advanced/reference#rules) in the YAML Reference for more details.

## Prompts

Prompts blocks are pre-written, reusable prompts that can be referenced at any time during chat. They are especially useful as context for repetitive and/or complex tasks. [Explore prompts](https://hub.continue.dev/explore/prompts) on the hub.

Prompt blocks have the same syntax as [prompt files](../../advanced/deep-dives/prompts.md). The `config.yaml` spec for `prompts` can be found [here](../../advanced/reference#prompts).

## Data

Data blocks allow you send your development data to custom destinations of your choice. Development data can be used for a variety of purposes, including analyzing usage, gathering insights, or fine-tuning models. You can read more about development data [here](../../advanced/deep-dives/development-data.md). Explore data block examples [here](https://hub.continue.dev/explore/data).

Data destinations are configured in the [`data`](../../advanced/reference#data) section of `config.yaml`.
