---
title: ⚙️ Core Features
description: PearAI is the open-source autopilot for software development and a fork of Continue.
keywords: [core-features, intro, continue, autopilot, chatgpt]
---

# ⚙️ Core Features

- `CMD+I` - Inline code editing.

- `CMD+L` - New chat. `CMD+SHIFT+L` - Append to current chat.

  - Address sign commands

    - `@filename/foldername`, `@docs` - Add files, folders or documentation. You can also choose to add your own documentation links by scrolling all the way down and clicking “Add Docs”.
    - All the other address sign commands are listed in this [doc](https://trypear.ai/customization/context-providers). We want them to be indicated on one bullet point each, so they can be easily seen as a list. In the doc linked, they're too separated, requiring too much scrolling.

  - Slash commands

    - `/commit` - Generates a commit message for all your current changes.
    - `/cmd` - Generate a CLI command and paste it in the terminal directly.
    - `/edit` - Bring code to your chat with `CMD+L` or `CMD+SHIFT+L` (`CTRL` for Windows).
    - `/comment` - Works just like `/edit` but adds comments to your code
    - `/test` - Works just like `/edit` but makes unit tests for highlighted or provided code.
    - Include the [excerpt](https://trypear.ai/customization/slash-commands#custom-slash-commands) about custom slash commands

  - Quick terminal debug: Use `CMD+SHIFT+R` to Bring last terminal text to your chat.
