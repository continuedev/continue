---
title: Assistants Introduction
sidebar_label: Introduction
description: Overview of assistants functionality.
keywords: [assistants, overview, customization]
---

# Introduction to Assistants

Custom AI code assistants are configurations of building [blocks](../blocks/intro.md) that enable you to receive assistance tailored to your specific use cases.

`config.yaml` is a format for defining custom AI code assistants. An assistant has some top-level properties (e.g. `name`, `version`), but otherwise consists of composable lists of **blocks**, which are atomic building blocks of an assistant, including things like models, rules, prompts, context, and docs.

The `config.yaml` is parsed by the open-source Continue IDE extensions to create custom assistant experiences. When you log in to hub.continue.dev, your assistants will automatically be synced with the IDE extensions.
