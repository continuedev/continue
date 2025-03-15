---
title: How Apply works
sidebar_position: 4
description: How Apply works
keywords: [apply, works]
---

When you use Chat or Edit to generate code, the model's output may not perfectly align with your existing codebase. The Apply feature uses a model to take the original code and the generated code from a model like Claude, then applies the changes to your file directly.

The Apply model is designed to understand both the structure of your existing code and the intent of the generated code, creating a seamless and fast apply between the two. This is especially useful for large files that might exceed the context window of your primary model, as the Apply model focuses specifically on the changes needed.

When you click "Apply to current file" on a code block in Chat, or accept an Edit suggestion, the Apply model processes the original code and the generated code to create the most appropriate changes to your file.

If you would like to view the exact prompt that is sent to the model during Apply, you can [view this in the prompt logs](../troubleshooting.mdx#llm-prompt-logs). 