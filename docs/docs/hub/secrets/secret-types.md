---
title: Secret Types
description: Intro to Secret Types
keywords: [secrets, types]
sidebar_label: Types
---

# Secret Types

## User secrets

User secrets are defined by the user for themselves. This means that user secrets are available only to the user that created them. User secrets are assumed to be safe for the user to know, so they will be sent to the IDE extensions alongside the config.yaml. This allows requests to APIs to be made directly from the IDE extensions. You can use user secrets on solo, teams, and enterprise tiers.

## Org secrets

Org secrets are defined by admins for their organization. Org secrets are available to anyone in the organization to use with assistants in that organization. Org secrets are assumed to not be shareable with the user (e.g. you are a team lead who wants to give team members access to models without passing out API keys). In this case, the LLM requests are proxied through Continue (api.continue.dev or the on-premise proxy) and the secrets are never sent to the IDE extensions. You can only use org secrets on teams and enterprise tiers.
