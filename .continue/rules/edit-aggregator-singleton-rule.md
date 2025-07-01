---
patterns: ["EditAggregator", "processEdit"]
glob: "**/*.tsx"
name: "Enforce EditAggregator Singleton"
description: "Ensure that EditAggregator is used as a singleton in the codebase."
---

When you encounter usage of EditAggregator, be sure that this is compatible with the singleton nature of the EditAggregator class. If you are creating a new instance of EditAggregator, you should instead use the existing singleton. Refer to the `aggregateEdits.ts` to examine how the singleton pattern is used. Do not create a new instance of EditAggregator.
