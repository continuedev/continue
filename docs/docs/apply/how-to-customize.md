---
title: How to customize
sidebar_position: 6
description: How to customize Apply
keywords: [apply, customize]
---

import TabItem from "@theme/TabItem";
import Tabs from "@theme/Tabs";

You can customize the Apply feature in several ways:

## Custom Prompt Templates

The Apply feature uses a prompt template to format the original code and the generated code for the model. You can customize this template in your `config.yaml`:

```yaml title="config.yaml"
models:
  - name: My Apply Model
    provider: openai
    model: gpt-4o
    apiKey: YOUR_OPENAI_API_KEY
    roles:
      - apply
    promptTemplates:
      apply: "<code>{{{ original_code }}}</code>\n<update>{{{ new_code }}}</update>"
```

The default template for most models is similar to the one shown above, but you can customize it to better suit your needs or to optimize for specific models.

## Multiple Apply Models

You can configure multiple models with the `apply` role:

```yaml title="config.yaml"
models:
  - name: Morph Fast Apply
    provider: openai
    model: morph-v0
    apiKey: YOUR_MORPH_API_KEY
    apiBase: https://api.morphllm.com/v1/
    roles:
      - apply
    promptTemplates:
      apply: "<code>{{{ original_code }}}</code>\n<update>{{{ new_code }}}</update>"
      
  - name: GPT-4o Apply
    provider: openai
    model: gpt-4o
    apiKey: YOUR_OPENAI_API_KEY
    roles:
      - apply
```

You can then select which model to use for Apply in the Continue settings under the "Active Models" section. 