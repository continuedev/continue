---
title: How Edit works
sidebar_position: 4
description: How it works
keywords: [edit, cmd l, works]
---

Using the highlighted code, the contents of the current file containing your highlight, and your input instructions, we prompt the model to edit the code according to your instructions. No other additional context is provided to the model.

The model response is then streamed directly back to the highlighted range in your code, where we apply a diff formatting to show the proposed changes.

If you accept the diff, we remove the previously highlighted lines, and if you reject the diff, we remove the proposed changes.

If you would like to view the exact prompt that is sent to the model during an edit, you can [find it in the prompt logs](../troubleshooting.mdx#check-the-logs).
