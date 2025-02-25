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

Once here, you’ll be able to
Edit YAML configuration for the block
Change name, description, icon, etc.

[SCREENSHOT OF REMIX BLOCK PAGE]

Clicking “Create block” will make this assistant available for use

## Create a block from scratch

To create a block from scratch, you will need to click “New block” in the top bar.

After filling out information on the block, you will want to create a block following the config.yaml reference documentation.

For values that the user of the block needs to set, you can use template variables (e.g. `${{ inputs.API_KEY}}`, where API_KEY will be set by the user from the `with` clause in their assistant.
