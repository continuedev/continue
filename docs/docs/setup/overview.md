---
title: Overview
description: Get started with Continue and tailor it to your needs
keywords: [setup, customization, models, configuration, LLMs]
---

# Overview

Continue is a flexible AI coding assistant that allows you to choose and customize your Large Language Models (LLMs). This guide will help you get started and make Continue work best for you.

## Quick Start

1. When you first install Continue, you can use it immediately with our free proxy server.
2. As you get familiar with Continue, you can set up your own API keys and customize your experience.

## Choosing Your Models

Continue works with a variety of LLMs:

- Commercial models (e.g., Claude 3 Opus via Anthropic API)
- Open-source models (e.g., Llama 3 running locally with Ollama)
- And many options in between

You'll need to select models for three main functions:

- [Chat](select-model.md#chat)
- [Autocomplete](select-model.md#autocomplete)
- [Embeddings](select-model.md#embeddings)

## Customization Options

Continue offers deep customization through `config.json` and `config.ts` files. These are located in:

- MacOS: `~/.continue/`
- Windows: `%userprofile%\.continue`

You can customize:

1. [Basic Configuration](configuration.md)
2. [Model Providers](model-providers.md)
3. [Model Selection](select-model.md)
4. [Context Providers](../customization/context-providers.md)
5. [Slash Commands](../customization/slash-commands.md)
6. [Advanced Options](../reference/config.mdx)

## Sharing Your Configuration

To share your Continue setup with a team:

1. Create a `.continuerc.json` file in your project's root directory.
2. Use the same JSON Schema as `config.json`.
3. This file will automatically apply on top of the local `config.json`.

Get started with Continue today and shape it to fit your coding workflow perfectly!
