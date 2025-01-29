---
title: User Settings Page
description: Reference for Adjusting User-Specific Settings
keywords: [config, settings, configuration, customize, customization, sidebar]
---

# The User Settings Page

The **User Settings page** can be accessed by clicking the gear icon in the header of the Continue sidebar.

![slash-commands](/img/header-buttons.png)

Which takes you to this page:

![User Settings Page](/img/settings-page.png)

Click the `Open Config File` button to open your configuration file. See the [Configuration Reference](../reference.md) for more information.

Below that, the following settings which are not part of a configuration file are available:

- `Wrap Codeblocks`: If on, enables text wrapping in code blocks. Off by default.
- `Display Raw Markdown`: If on, shows raw markdown in responses. Off by default.
- `Allow Anonymous Telemetry`: If on, allows Continue to send anonymous telemetry. **On** by default.
- `Disable Indexing`: Prevents indexing of the codebase, useful primarily for debugging purposes. Off by default.
- `Disable Session Titles`: Prevents generating summary titles for each chat session when turned on. Off by default
- `Response Text to Speech`: If on, reads LLM responses aloud with TTS. Off by default.
- `Show Chat Scrollbar`: If on, enables a scrollbar in the chat window. Off by default.
- `Use autocomplete cache`: If on, caches completions.
- `Use Chromium for Docs Crawling`: Use Chromium to crawl docs locally. Useful if the default Cheerio crawler fails on sites that require JavaScript rendering. Downloads and installs Chromium to ~/.continue/.utils. Off by default
- `Codeblock Actions Position`: Sets the position for the actions that show when hovering over codeblocks. Defaults to `top`
- `Multiline Autocompletions`: Controls multiline completions for autocomplete. Can be set to `always`, `never`, or `auto`. Defaults to `auto`
- `Font Size`: Specifies base font size for UI elements
- `Workspace prompts path`: Where to find Prompt Files in a workspace - replaces the default .continue/prompts
- `Disable autocomplete in files`: List of comma-separated glob pattern to disable autocomplete in matching files. E.g., "\_/.md, \*/.txt"
