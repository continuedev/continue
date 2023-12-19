---
title: Codebase Retrieval
description: Talk to your codebase
keywords: [talk, embeddings, codebase, experimental]
---

# Codebase Retrieval

Continue indexes your codebase so that when you input a message using Command+Enter, it can automatically pull in the most relevant context from throughout your workspace. This is done via a combination of embeddings-based retrieval and keyword search. By default, all embeddings are calculated locally with `all-MiniLM-L6-v2` and stored locally in `~/.continue/index`.

The codebase retrieval feature allows the following customization options by editing `config.json` as follows:

```json title="~/.continue/config.json"
{
    "retrievalSettings": {
        "nRetrieve": 100,
        ...
    }
}
```

### `nRetrieve`

Number of results to initially retrieve from vector database (default: 50)

### `nFinal`

Final number of results to use after re-ranking (default: 10)

### `useReranking`

Whether to use re-ranking, which will allow initial selection of `nRetrieve` results, then will use an LLM to select the top `nFinal` results (default: True)

### `rerankGroupSize`

Number of results to group together when re-ranking. Each group will be processed in parallel. (default: 5)

### `ignoreFiles`

Files to ignore when indexing the codebase. You can use glob patterns, such as `**/*.py`. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase. (default: [])

### `openaiApiKey`

OpenAI API key. If set, Continue will calculate embeddings by calling OpenAI's `ada-002` embeddings API. (default: None)

### Azure OpenAI

These settings allow you to connect to an Azure-hosted OpenAI API. All must be filled out in order to use Azure OpenAI for embeddings, as well as the `openaiApiKey`.

#### `apiBase`

OpenAI API base URL (default: None)

#### `apiType`

OpenAI API type (default: None)

#### `apiVersion`

OpenAI API version (default: None)

#### `organizationId`

OpenAI organization ID (default: None)
