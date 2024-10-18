---
description: Talk to your codebase
keywords: [talk, embeddings, reranker, codebase, experimental]
---

# @Codebase

Continue indexes your codebase so that it can later automatically pull in the most relevant context from throughout your workspace. This is done via a combination of embeddings-based retrieval and keyword search. By default, all embeddings are calculated locally with `all-MiniLM-L6-v2` and stored locally in `~/.continue/index`.

Currently, the codebase retrieval feature is available as the "codebase" and "folder" context providers. You can use them by typing `@Codebase` or `@Folder` in the input box, and then asking a question. The contents of the input box will be compared with the embeddings from the rest of the codebase (or folder) to determine relevant files.

Here are some common use cases where it can be useful:

- Asking high-level questions about your codebase
  - "How do I add a new endpoint to the server?"
  - "Do we use VS Code's CodeLens feature anywhere?"
  - "Is there any code written already to convert HTML to markdown?"
- Generate code using existing samples as reference
  - "Generate a new React component with a date picker, using the same patterns as existing components"
  - "Write a draft of a CLI application for this project using Python's argparse"
  - "Implement the `foo` method in the `bar` class, following the patterns seen in other subclasses of `baz`.
- Use `@Folder` to ask questions about a specific folder, increasing the likelihood of relevant results
  - "What is the main purpose of this folder?"
  - "How do we use VS Code's CodeLens API?"
  - Or any of the above examples, but with `@Folder` instead of `@Codebase`

Here are use cases where it is not useful:

- When you need the LLM to see _literally every_ file in your codebase
  - "Find everywhere where the `foo` function is called"
  - "Review our codebase and find any spelling mistakes"
- Refactoring
  - "Add a new parameter to the `bar` function and update usages"

## Configuration

There are a few options that let you configure the behavior of the codebase context provider. These can be set in `config.json`, and are the same for the codebase and folder context providers:

```json title="config.json"
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

## Ignore files during indexing

Continue respects `.gitignore` files in order to determine which files should not be indexed. If you'd like to exclude additional files, you can add them to a `.continueignore` file, which follows the exact same rules as `.gitignore`.

If you want to see exactly what files Continue has indexed, the metadata is stored in `~/.continue/index/index.sqlite`. You can use a tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to view the `tag_catalog` table within this file.

If you need to force a refresh of the index, reload the VS Code window with `cmd/ctrl + shift + p` + "Reload Window".

## Repository map

Models in the Claude 3, Llama 3.1, Gemini 1.5, and GPT-4o families will automatically use a [repository map](../context-providers.md#repository-map) during codebase retrieval, which allows the model to understand the structure of your codebase and use it to answer questions. Currently, the repository map only contains the filepaths in the codebase.
