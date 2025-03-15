---
title: How to use Apply
sidebar_position: 2
description: How to use Apply
keywords: [apply, how to use]
---

The Apply feature is automatically used when you:

1. Click "Apply to current file" on a code block in Chat
2. Accept an Edit suggestion

## Using Apply with Chat

When you're chatting with Continue and receive a code block in response, you'll see several options below the code block:

- **Apply to current file**: This uses the Apply model to integrate the generated code into your current file
- **Insert at cursor**: This inserts the code at your cursor position without using the Apply model
- **Copy**: This copies the code to your clipboard

When you click "Apply to current file", the Apply model analyzes both your original code and the generated code to create a precise diff that can be applied to your file.

## Using Apply with Edit

When you use the Edit feature (by selecting code and pressing <kbd>cmd/ctrl</kbd> + <kbd>I</kbd>), the Apply model is automatically used when you accept the suggested changes.

The Apply model ensures that the changes are integrated seamlessly into your codebase, preserving the structure and style of your existing code while implementing the requested changes.

## Benefits of Using Apply
- **Faster**: Apply models like Morph are optimized for speed, making coding with AI quick and efficient 
- **Handles large files**: Apply can work with files that exceed the context window of your primary model
- **Preserves code structure**: Apply understands the structure of your code and makes changes that respect that structure
- **Reduces manual editing**: Apply automates the process of integrating generated code into your existing codebase
- **Better Applies**: Apply models like Morph are optimized for applying code changes, making the integration process quick and efficient 