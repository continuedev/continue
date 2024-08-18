---
title: Codebase Retrieval
description: Talk to your codebase
keywords: [talk, embeddings, reranker, codebase, experimental]
---

# Codebase retrieval

Continue indexes your codebase so that it can later automatically pull in the most relevant context from throughout your workspace. This is done via a combination of embeddings-based retrieval and keyword search. By default, all embeddings are calculated locally with `all-MiniLM-L6-v2` and stored locally in `~/.continue/index`.

Currently, the codebase retrieval feature is available as the "codebase" and "folder" context providers. You can use them by typing `@codebase` or `@folder` in the input box, and then asking a question. The contents of the input box will be compared with the embeddings from the rest of the codebase (or folder) to determine relevant files.

Here are some common use cases where it can be useful:

- Asking high-level questions about your codebase
  - "How do I add a new endpoint to the server?"
  - "Do we use VS Code's CodeLens feature anywhere?"
  - "Is there any code written already to convert HTML to markdown?"
- Generate code using existing samples as reference
  - "Generate a new React component with a date picker, using the same patterns as existing components"
  - "Write a draft of a CLI application for this project using Python's argparse"
  - "Implement the `foo` method in the `bar` class, following the patterns seen in other subclasses of `baz`.
- Use `@folder` to ask questions about a specific folder, increasing the likelihood of relevant results
  - "What is the main purpose of this folder?"
  - "How do we use VS Code's CodeLens API?"
  - Or any of the above examples, but with `@folder` instead of `@codebase`

Here are use cases where it is not useful:

- When you need the LLM to see _literally every_ file in your codebase
  - "Find everywhere where the `foo` function is called"
  - "Review our codebase and find any spelling mistakes"
- Refactoring
  - "Add a new parameter to the `bar` function and update usages"

## Configuration

There are a few options that let you configure the behavior of the codebase context provider. These can be set in `config.json`, and are the same for the codebase and folder context providers:

```json title="~/.continue/config.json"
{
  "contextProviders": [
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ]
}
```

### `nRetrieve`

Number of results to initially retrieve from vector database (default: 25)

### `nFinal`

Final number of results to use after re-ranking (default: 5)

### `useReranking`

Whether to use re-ranking, which will allow initial selection of `nRetrieve` results, then will use an LLM to select the top `nFinal` results (default: true)



### Writing a custom `EmbeddingsProvider`

If you have your own API capable of generating embeddings, Continue makes it easy to write a custom `EmbeddingsProvider`. All you have to do is write a function that converts strings to arrays of numbers, and add this to your config in `config.ts`. Here's an example:

```ts title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.embeddingsProvider = {
    embed: (chunks: string[]) => {
      return Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch("https://example.com/embeddings", {
            method: "POST",
            body: JSON.stringify({ text: chunk }),
          });
          const data = await response.json();
          return data.embedding;
        }),
      );
    },
  };

  return config;
}
```

## Reranking providers

The reranker plays a crucial role in refining the results retrieved from your codebase. It processes the initial set of results obtained through embeddings-based retrieval, improving their relevance and accuracy for your queries.

Continue offers several reranking options: `cohere`, `voyage`, `llm`, `hugginface-tei`, and `free-trial`, which can be configured in `config.json`.

### Voyage AI

Voyage AI offers the best reranking model for code with their rerank-lite-1 model. After obtaining an API key from [here](https://www.voyageai.com/), you can configure like this:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-lite-1",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

### Cohere

See Cohere's documentation for rerankers [here](https://docs.cohere.com/docs/rerank-2).

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "cohere",
    "params": {
      "model": "rerank-english-v3.0",
      "apiKey": "<COHERE_API_KEY>"
    }
  }
}
```

### LLM

If you only have access to a single LLM, then you can use it as a reranker. This is discouraged unless truly necessary, because it will be much more expensive and still less accurate than any of the above models trained specifically for the task. Note that this will not work if you are using a local model, for example with Ollama, because too many parallel requests need to be made.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "llm",
    "params": {
      "modelTitle": "My Model Title"
    }
  }
}
```

The `"modelTitle"` field must match one of the models in your "models" array in config.json.

### Text Embeddings Inference

[Hugging Face Text Embeddings Inference](https://huggingface.co/docs/text-embeddings-inference/en/index) enables you to host your own [reranker endpoint](https://huggingface.github.io/text-embeddings-inference/#/Text%20Embeddings%20Inference/rerank). You can configure your reranker as follows:

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "huggingface-tei",
    "params": {
        "apiBase": "http://localhost:8080",
        "truncate": true,
        "truncation_direction": "Right"
    }
  },
}
```

### Free Trial (Voyage AI)

Continue offers a free trial of Voyage AI's reranking model.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "free-trial"
  }
}
```

## Ignore files during indexing

Continue respects `.gitignore` files in order to determine which files should not be indexed. If you'd like to exclude additional files, you can add them to a `.continueignore` file, which follows the exact same rules as `.gitignore`.

If you want to see exactly what files Continue has indexed, the metadata is stored in `~/.continue/index/index.sqlite`. You can use a tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to view the `tag_catalog` table within this file.

If you need to force a refresh of the index, reload the VS Code window with `cmd/ctrl + shift + p` + "Reload Window".
