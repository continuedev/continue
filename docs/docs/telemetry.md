---
title: Telemetry
description: Continue collects anonymous usage information
keywords: [telemetry, anonymous, usage info, opt out]
---

# 🦔 Telemetry

## Overview

Continue collects and reports **anonymous** usage information. This data is essential to understanding how we should improve the library. You can opt out of it at any time. We use [Posthog](https://posthog.com/), an open source platform for product analytics, to collect and store the data. You can review the code [here](https://github.com/continuedev/continue/tree/main/server/continuedev/libs/util/telemetry.py).

## What we track

We track

- the steps that are run and their parameters
- whether you accept or reject suggestions (not the code itself)
- the traceback when an error occurs
- the name of your OS
- the name of the default model you configured

All data is anonymous and cleaned of PII before being sent to PostHog.

## How to opt out

The `~/.continue` directory contains a `config.json` file that looks like this:

```json title="~/.continue/config.json"
{
    "allowAnonymousTelemetry": true,
    ...
}
```

You can turn off anonymous telemetry by changing the value of `allowAnonymousTelemetry` to `false`.
