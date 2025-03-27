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

Below that, the following settings which are not part of a configuration file are available:

- `Show Session Tabs`: If on, displays tabs above the chat as an alternative way to organize and access your sessions. Off by default
- `Wrap Codeblocks`: If on, enables text wrapping in code blocks. Off by default.
- `Show Chat Scrollbar`: If on, enables a scrollbar in the chat window. Off by default.
- `Text-to-Speech Output`: If on, reads LLM responses aloud with TTS. Off by default.
- `Enable Session Titles`: If on, generates summary titles for each chat session after the first message, using the current Chat model. On by default.
- `Format Markdown`: If off, shows responses as raw text. On by default.
- `Allow Anonymous Telemetry`: If on, allows Continue to send anonymous telemetry. **On** by default.
- `Enable Indexing`: Enables indexing of the codebase for the @codebase and @code context providers. **On** by default.
- `Font Size`: Specifies base font size for UI elements
- `Multiline Autocompletions`: Controls multiline completions for autocomplete. Can be set to `always`, `never`, or `auto`. Defaults to `auto`
- `Disable autocomplete in files`: List of comma-separated glob pattern to disable autocomplete in matching files. E.g., "\_/.md, \*/.txt"

<!-- - `Use autocomplete cache`: If on, caches completions. -->
<!-- - `Use Chromium for Docs Crawling`: Use Chromium to crawl docs locally. Useful if the default Cheerio crawler fails on sites that require JavaScript rendering. Downloads and installs Chromium to ~/.continue/.utils. Off by default -->
<!-- - `Codeblock Actions Position`: Sets the position for the actions that show when hovering over codeblocks. Defaults to `top` -->
<!-- - `Workspace prompts path`: Where to find Prompt Files in a workspace - replaces the default .continue/prompts -->
