# Telemetry

## Overview

`Continue` collects and reports **anonymous** usage information. This data is essential to understanding how we should improve the library. You can opt out of it at any time.

We use [Posthog](https://posthog.com/), an open source platform for product analytics, to collect and store the data.

## What we track

We track the steps that are run and their parameters

## How to opt out

There is a `.continue` directory, which contains a `config.json` file that looks like this:

```json
{
  "allow_anonymous_telemetry": true
}
```

You can turn off anonymous telemetry by changing the value of `allow_anonymous_telemetry` to `false`.