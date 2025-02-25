---
title: Bundles
sidebar_label: Bundles
description: Introduction to Bundles
keywords: [blocks, bundles]
---

# Bundles

Bundles are collections of blocks that are commonly used together. You can use them to add multiple building blocks to your custom AI code assistants at once. They are only a concept on [hub.continue.dev](https://hub.continue.dev), so they are not represented in `config.yaml`.

## Use a bundle

Once you know which block you want to use, you’ll need to

1. Make sure the correct assistant is in the sidebar
2. Click “Add bundle on its page
3. Add any required inputs (e.g. secrets)
4. Select “Save” in assistant sidebar on the right hand side

[SCREENSHOT OF BLOCK READY TO BE SAVED]

After this, you can then go to your IDE extension using the "Open VS Code" or "Open Jetbrains" button and begin using the new blocks.

[SCREENSHOT OF VS CODE WITH BLOCK READY TO BE USED IN TOGGLE]

## Create a bundle

To create a bundle, click “New bundle” in the top bar.

For values that the user of the block needs to set, you can use template variables (e.g. `${{ inputs.API_KEY}}`, where API_KEY will be set by the user from the `with` clause in their assistant.

It’s not currently possible to remix a bundle.
