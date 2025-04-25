---
title: Model Blocks
sidebar_label: Model
description: Foundation of the entire assistant experience offering specialized capabilities
keywords: [model, blocks, chat, edit, apply, autocomplete, embedding, reranker]
sidebar_position: 1
---

These blocks form the foundation of the entire assistant experience, offering different specialized capabilities:

- **[Chat](../customize/model-roles.md#chat)**: Power conversational interactions about code and provide detailed guidance
- **[Edit](../customize/model-roles.md#edit)**: Handle complex code transformations and refactoring tasks
- **[Apply](../customize/model-roles.md#apply)**: Execute targeted code modifications with high accuracy
- **[Autocomplete](../customize/model-roles.md#autocomplete)**: Provide real-time suggestions as developers type
- **[Embedding](../customize/model-roles.md#embedding)**: Transform code into vector representations for semantic search
- **[Reranker](../customize/model-roles.md#reranker)**: Improve search relevance by ordering results based on semantic meaning

![Model Blocks Overview](/img/model-blocks-overview.png)

## Learn More

Continue supports [many model providers](../customize/model-providers), including Anthropic, OpenAI, Gemini, Ollama, Amazon Bedrock, Azure, xAI, DeepSeek, and more. Models can have various roles like `chat`, `edit`, `apply`, `autocomplete`, `embed`, and `rerank`.

Read more about roles [here](../customize/model-roles) and view [`models`](../reference.md#models) in the YAML Reference.
