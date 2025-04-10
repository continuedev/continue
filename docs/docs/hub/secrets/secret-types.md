---
title: Secret Types
description: Intro to Secret Types
keywords: [secrets, types]
sidebar_label: Types
---

# Secret Types

The Continue Hub comes with secrets management built-in. Secrets are values such as API keys or endpoints that can be shared across assistants and within organizations.

## User secrets

User secrets are defined by the user for themselves. This means that user secrets are available only to the user that created them. User secrets are assumed to be safe for the user to know, so they will be sent to the IDE extensions alongside the assistant `config.yaml`. 

This allows API requests to be made directly from the IDE extensions. You can use user secrets with [Solo](../governance/pricing.md#solo), [Teams](../governance/pricing.md#teams), and [Enterprise](../governance/pricing.md#enterprise). User secrets can be managed [here](https://hub.continue.dev/settings/secrets) in the hub.

## Org secrets

Org secrets are defined by admins for their organization. Org secrets are available to anyone in the organization to use with assistants in that organization. Org secrets are assumed to not be shareable with the user (e.g. you are a team lead who wants to give team members access to models without passing out API keys). 

This is why LLM requests are proxied through api.continue.dev / on-premise proxy and secrets are never sent to the IDE extensions. You can only use org secrets on [Teams](../governance/pricing.md#teams) and [Enterprise](../governance/pricing.md#enterprise). If you are an admin, you can manage secrets for your organization from the org settings page.