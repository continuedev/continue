# Content Mapping: Docusaurus to Mintlify

## Overview

This document maps the current Docusaurus content structure to the new Mintlify 4-tab organization while preserving all existing URLs.

## Tab 1: User Guide

**Purpose**: Getting started, core features, and practical guides

### Mapped Content:

- **Introduction** → `/index` (homepage)
- **Getting Started**
  - `/getting-started/overview`
  - `/getting-started/install`
- **Features**
  - `/features/overview`
  - `/features/chat/*` (quick-start, how-it-works)
  - `/features/autocomplete/*` (quick-start, how-it-works)
  - `/features/edit/*` (quick-start, how-it-works)
  - `/features/agent/*` (quick-start, how-it-works)
- **Guides**
  - `/guides/overview`
  - `/guides/ollama-guide`
  - `/guides/llama3.1`
  - `/guides/set-up-codestral`
  - `/guides/running-continue-without-internet`
  - `/guides/custom-code-rag`
  - `/guides/build-your-own-context-provider`
  - `/guides/how-to-self-host-a-model`
- **Troubleshooting** → `/troubleshooting`

## Tab 2: Customize

**Purpose**: Configuration, customization, and advanced setup

### Mapped Content:

- **Customization**
  - `/customization/overview`
  - `/customization/models`
  - `/customization/prompts`
  - `/customization/rules`
  - `/customization/mcp-tools`
- **Advanced**
  - `/advanced/overview`
  - **Model Providers**
    - Top-level providers (anthropic, openai, azure, etc.)
    - More providers (groq, together, lmstudio, etc.)
  - **Model Roles**
    - `/advanced/model-roles/*` (intro, chat, autocomplete, edit, apply, embeddings, reranking)
  - **Context Providers**
    - `/advanced/context/codebase`
    - `/advanced/context/documentation`
  - **Deep Dives**
    - `/advanced/deep-dives/*` (configuration, settings, slash-commands, rules, prompts, etc.)
  - `/advanced/telemetry`
  - `/advanced/custom-providers`
  - `/advanced/json-reference`
  - `/advanced/yaml-migration`

## Tab 3: Hub

**Purpose**: Continue Hub features and team collaboration

### Mapped Content:

- **Hub Introduction** → `/hub/introduction`
- **Assistants**
  - `/hub/assistants/intro`
  - `/hub/assistants/use-an-assistant`
  - `/hub/assistants/create-an-assistant`
  - `/hub/assistants/edit-an-assistant`
- **Blocks**
  - `/hub/blocks/intro`
  - `/hub/blocks/use-a-block`
  - `/hub/blocks/block-types`
  - `/hub/blocks/create-a-block`
  - `/hub/blocks/bundles`
- **Governance**
  - `/hub/governance/creating-an-org`
  - `/hub/governance/org-permissions`
  - `/hub/governance/pricing`
- **Secrets**
  - `/hub/secrets/secret-types`
  - `/hub/secrets/secret-resolution`
- **Additional Pages**
  - `/hub/sharing`
  - `/hub/source-control`

## Tab 4: Reference

**Purpose**: API reference and technical documentation

### Mapped Content:

- **Reference Documentation** → `/reference`

## URL Preservation Strategy

1. All URLs remain exactly as they are in Docusaurus
2. No content moves to different paths
3. The 4-tab structure is purely navigational
4. Users can still access content via direct URLs
5. Internal links don't need to be updated

## Benefits

- Zero broken links
- SEO preservation
- Smooth user transition
- Clear organizational structure
- Minimal redirect configuration needed
