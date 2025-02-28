---
title: Development Data
description: Collecting data on how you build software
keywords: [development data, dev data, LLM-aided development]
---

# Development Data

When you use Continue, you automatically collect data on how you build software. By default, this development data is saved to `.continue/dev_data` on your local machine.

You can read more about how development data is generated as a byproduct of LLM-aided development and why we believe that you should start collecting it now: [It’s time to collect data on how you build software](https://blog.continue.dev/its-time-to-collect-data-on-how-you-build-software)

## Custom Data Destinations

You can also configure custom destinations for your data, including remote HTTP endpoints and local file directories.

For hub assistants, data destinations are configured in `data` blocks. Visit the hub to [explore example data blocks](https://hub.continue.dev/explore/data) or [create your own](https://hub.continue.dev/new?type=block&block=data).

See more details about adding `data` blocks to your configuration files in the [YAML specification](../../yaml-reference.md#data)

When sending development data to your own HTTP endpoint, it will receive an event JSON blob at the given `schema` version. You can view event names, schema versions, and fields [here in the source code](https://github.com/continuedev/continue/tree/main/packages/config-yaml/src/schemas/data).
