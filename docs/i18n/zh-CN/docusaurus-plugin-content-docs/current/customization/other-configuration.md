---
title: Other Configuration
description: Swap out different LLM providers
keywords: [temperature, custom policies, custom system message]
---

# Other Configuration

See the [config.json Reference](../reference/config) for the full list of configuration options.

## Customize System Message

You can write your own system message, a set of instructions that will always be top-of-mind for the LLM, by setting the `systemMessage` property to any string. For example, you might request "Please make all responses as concise as possible and never repeat something you have already explained."

System messages can also reference files. For example, if there is a markdown file (e.g. at `/Users/nate/Documents/docs/reference.md`) you'd like the LLM to know about, you can reference it with [Mustache](http://mustache.github.io/mustache.5.html) templating like this: "Please reference this documentation: \{\{ Users/nate/Documents/docs/reference.md \}\}". As of now, you must use an absolute path.

## Temperature

Set `temperature` to any value between 0 and 1. Higher values will make the LLM more creative, while lower values will make it more predictable. The default is 0.5.
