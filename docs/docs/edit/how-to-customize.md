---
title: How to customize
sidebar_position: 5
description: How to customize Edit
keywords: [edit, cmd i, works]
---

You can configure a particular model to be used for Edit using the `inlineEdit` property.

```json title="config.json"
"experimental": {
    "modelRoles": {
        "inlineEdit": "MODEL_TITLE",
    }
}
```

Using New OpenAI Models (o1, o1-mini)
When you want to use OpenAI's new models such as o1 or o1-mini, you will need to adjust your config.json file. These new models do not support the old request parameters, which can lead to them being unusable if not properly configured. To ensure compatibility, please modify your config.json as follows:

Original Configuration:
```json title="config.json"
"completionOptions": {
    "temperature": 0, 
    "maTokens": 4096 
},
```
Updated Configuration:
```json title="config.json"
"completionOptions": {
    "temperature": 1,
    "maxCompletionTokens": 4096
},
```
