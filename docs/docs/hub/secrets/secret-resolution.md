---
title: Secret Resolution
description: Intro to Secret Resolution
keywords: [secrets, resolution]
sidebar_label: Resolution
---

# Secret Resolution

[User or Org secrets](./secret-types.md) should be used depending on how users want them to be shared within their organization and assistants.

For individual users and [Solo](../governance/pricing.md#solo) organizations, secret resolution is performed in the following order:

1. User [models add-on](../governance/pricing.md#models-add-on) (if subscribed)
2. [User secrets](../secrets/secret-types.md#user-secrets) (if set)
3. [Free trial](../governance/pricing.md#free-trial) (if below limit)

For [Teams](../governance/pricing.md#teams) and [Enterprise](../governance/pricing.md#enterprise) organizations, secret resolution is performed in the following order:

1. Org [models add-on](../governance/pricing.md#models-add-on) (if subscribed)
2. [Org secrets](../secrets/secret-types.md#org-secrets) (if set)
3. [User secrets](../secrets/secret-types.md#user-secrets) (if set)