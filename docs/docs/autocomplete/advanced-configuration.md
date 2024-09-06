---
title: Advanced configuration
description: \-advanced configuration
keywords: [configuration, advanced]
---

# Advanced configuration

Experiment with these settings to find the perfect balance between suggestion quality and system performance for your specific needs and hardware capabilities:

```config.json
 "tabAutocompleteOptions": {
   "useCopyBuffer": false,
   "maxPromptTokens": 400,
   "prefixPercentage": 0.5
   "multilineCompletions": "always"
 }
```

- `useCopyBuffer`: Determines if the clipboard content should be considered in prompt construction.
- `maxPromptTokens`: Sets the maximum number of tokens for the prompt, balancing context and speed.
- `prefixPercentage`: Defines the proportion of the prompt dedicated to the code before the cursor.
- `multilineCompletions`: Controls whether suggestions can span multiple lines ("always", "never", or "auto").

For a comprehensive guide on all configuration options and their impacts, refer to our (detailed configuration documentation).
