---
title: Creating Blocks
sidebar_label: Create a Block
description: Guide to Creating Assistant Blocks
keywords: [blocks, creation, create, use]
---

# Creating Blocks

## Remix a block

You should remix a block if you want to use it after some modifications.

By clicking the “remix” button, you’ll be taken to the “Create a remix” page.

![Remix block button](/img/hub/block-remix-button.png)

Once here, you’ll be able to

1. Edit YAML configuration for the block
2. Change name, description, icon, etc.

Clicking “Create block” will make this assistant available for use

## Create a block from scratch

To create a block from scratch, you will need to click “New block” in the top bar.

![New block button](/img/hub/block-new-button.png)

After filling out information on the block, you will want to create a block following the `config.yaml` [reference documentation](../../yaml-reference.md).

![New block page](/img/hub/block-new-page.png)

### Block inputs

Blocks can receive values, including secrets, as inputs through templating. For values that the user of the block needs to set, you can use template variables, e.g., `${{ inputs.API_KEY}}`. Then, the user can set e.g. `API_KEY: ${{ secrets.MY_API_KEY }}` in the `with` clause in their assistant.
