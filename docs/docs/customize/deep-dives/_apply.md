---
description: Learn how to use the Apply feature
keywords: [apply, speculative]
toc_max_heading_level: 5
---

<!-- This is a work in progress and excluded by prefixing the file name with an underscore -->

# Apply

## Instant Diff Apply

If you have large files (exeeding the output token of your model) the edit apply will delete all lines that exceed the model window. To mitigate you can instead of applying the changes directly, ask the chat LLM to "generate a unified diff".
The resulting diff (if the LLM has not made a mistake) can be instantly applied, changing only the lines that need to change.

Explainer Video: https://youtu.be/b7Xxsot4gyw
