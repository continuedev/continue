---
title: Bundles
sidebar_label: Bundles
description: Introduction to bundles
keywords: [blocks, bundles]
---

# Bundles

Bundles are collections of blocks that are commonly used together. You can use them to add multiple building blocks to your custom AI code assistants at once. They are only a concept on [hub.continue.dev](https://hub.continue.dev), so they are not represented in `config.yaml`.

## Use a bundle

Once you know which bundle you want to use, you’ll need to

1. Make sure the correct assistant is in the sidebar
2. Click “Add all blocks". This adds the individual blocks to your assistant.
3. Add any required inputs (e.g. secrets) for each block.
4. Select “Save changes” in assistant sidebar on the right hand side

After this, you can then go to your IDE extension using the "Open VS Code" or "Open Jetbrains" buttons and begin using the new blocks.

## Create a bundle

To create a bundle, click “New bundle” in the header.

![New bundle button](/img/hub/bundle-new-button.png)

Choose a name, slug, description, and visibility for your bundle.

Then, search blocks using the "Search blocks" input and add them to your bundle.

![Create bundle page](/img/hub/bundle-create-page.png)

Once you have added all the blocks you want in your bundle, click "Create Bundle" to save it and make it available for use.

## Remix a bundle

It is not currently possible to remix a bundle.