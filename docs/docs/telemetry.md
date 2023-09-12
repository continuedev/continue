# 🦔 Telemetry

## Overview

Continue collects and reports **anonymous** usage information. This data is essential to understanding how we should improve the library. You can opt out of it at any time. We use [Posthog](https://posthog.com/), an open source platform for product analytics, to collect and store the data. You can review the code [here](https://github.com/continuedev/continue/tree/main/continuedev/src/continuedev/libs/util/telemetry.py).

## What we track

We track

- the steps that are run and their parameters
- whether you accept or reject suggestions (not the code itself)
- the traceback when an error occurs
- the name of your OS
- the name of the default model you configured

All data is anonymous and cleaned of PII before being sent to PostHog.

## How to opt out

There is a `.continue` directory, which contains a `config.py` file that looks like this:

```python
config = ContinueConfig(
    allow_anonymous_telemetry=True,
    ...
)
```

You can turn off anonymous telemetry by changing the value of `allow_anonymous_telemetry` to `False`.
