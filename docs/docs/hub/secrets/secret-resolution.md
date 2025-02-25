---
title: Secret Resolution
description: Intro to Secret Resolution
keywords: [secrets, resolution]
sidebar_label: Resolution
---

# Secret Resolution

hub.continue.dev comes with built-in secrets management built in. There are multiple levels of secrets depending on how users want them to be shared and their organization tier.

For individual users and solo tier organizations, secret resolution is done in the following order:

1. User models add-on (if subscribed)
2. User secrets (if set)
3. Free trial (if below limit)

For teams tier and enterprise tier organizations, secret resolution is done in the following order:

1. Org models add-on (if subscribed)
2. Org secrets (if set)
3. User secrets (if set)
