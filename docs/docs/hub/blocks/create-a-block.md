---
title: Create a block
sidebar_label: Create a block
description: Guide to creating blocks
keywords: [blocks, creation, create, use]
---

# Create a block

## Remix a block

You should remix a block if you want to use it after some modifications.

By clicking the “remix” button, you’ll be taken to the “Create a remix” page.

![Remix block button](/img/hub/block-remix-button.png)

Once here, you’ll be able to 1) edit YAML configuration for the block and 2) change name, description, icon, etc. Clicking “Create block” will make this block available for use in an assistant.

## Create a block from scratch

To create a block from scratch, you will need to click “New block” in the top bar.

![New block button](/img/hub/block-new-button.png)

After filling out information on the block, you will want to create a block following the `config.yaml` [reference documentation](../../reference.md). Refer to examples of blocks on [hub.continue.dev](https://hub.continue.dev/explore/models) and visit the [YAML Reference](../../reference.md#complete-yaml-config-example) docs for more details.

![New block page](/img/hub/block-new-page.png)

### Block inputs

Blocks can receive values, including secrets, as inputs through templating. For values that the user of the block needs to set, you can use template variables (e.g. `${{ inputs.API_KEY}}`). Then, the user can set `API_KEY: ${{ secrets.MY_API_KEY }}` in the `with` clause of their assistant.
