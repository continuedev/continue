---
title: Codebase Retrieval
description: Talk to your codebase
keywords: [talk, embeddings, codebase, experimental]
---

# Codebase Retrieval

Continue indexes your codebase so that when you input a message using Command+Enter, it can automatically pull in the most relevant context from throughout your workspace. This is done via a combination of embeddings-based retrieval and keyword search. By default, all embeddings are calculated locally with `all-MiniLM-L6-v2` and stored locally in `~/.continue/embeddings`.

The codebase retrieval feature allows the following customization options by editing `config.json` as follows:

```json title="~/.continue/config.json"
{
    "retrieval_settings": {
        "n_retrieve": 100,
        ...
    }
}
```

### `n_retrieve`

Number of results to initially retrieve from vector database (default: 50)

### `n_final`

Final number of results to use after re-ranking (default: 10)

### `use_reranking`

Whether to use re-ranking, which will allow initial selection of `n_retrieve` results, then will use an LLM to select the top `n_final` results (default: True)

### `rerank_group_size`

Number of results to group together when re-ranking. Each group will be processed in parallel. (default: 5)

### `ignore_files`

Files to ignore when indexing the codebase. You can use glob patterns, such as `**/*.py`. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase. (default: [])

### `openai_api_key`

OpenAI API key. If set, Continue will calculate embeddings by calling OpenAI's `ada-002` embeddings API. (default: None)

### Azure OpenAI

These settings allow you to connect to an Azure-hosted OpenAI API. All must be filled out in order to use Azure OpenAI for embeddings, as well as the `openai_api_key`.

#### `api_base`

OpenAI API base URL (default: None)

#### `api_type`

OpenAI API type (default: None)

#### `api_version`

OpenAI API version (default: None)

#### `organization_id`

OpenAI organization ID (default: None)
