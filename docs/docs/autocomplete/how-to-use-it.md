---
title: How to use it
description: How to use it
keywords: [how]
---

# How to use it

Tab autocomplete provides inline code suggestions as you type. To enable it, simply click the "Continue" button in the status bar at the bottom right of your IDE or ensure the "Enable Tab Autocomplete" option is checked in your IDE settings.

## See when ghost text appears

Autocomplete will suggest code based on your recent changes for every keystroke or cursor movement. You'll see suggestions appear as ghost text when adding new code or when modifying existing code. Suggestions may not always appear if no changes are predicted.

## Accept the suggestions

Accept a full suggestion by pressing Tab, or reject it with Esc. Use Ctrl/CMD + → to accept part of a suggestion word-by-word, allowing for more granular control. To reject a suggestion, simply continue typing or press Escape.

:::tip

Getting only ever single-line suggestions? To ensure multi-line completions, set "multilineCompletions": "always" in tabAutocompleteOptions. If you're still seeing only single-line completions, try temporarily moving text below your cursor out of your active file or switching to a larger model.

:::
