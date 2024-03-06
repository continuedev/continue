---
title: Codebase Retrieval
description: Talk to your codebase
keywords: [talk, embeddings, codebase, experimental]
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

## Embeddings providers

We also support other methods of generating embeddings, which can be configured with the `"embeddingsProvider"` property in `config.json`. We currently have built-in support for the following providers:

### Transformers.js

[Transformers.js](https://huggingface.co/docs/transformers.js/index) is a JavaScript port of the popular [Transformers](https://huggingface.co/transformers/) library. It allows embeddings to be calculated locally in the browser (or in this case inside of the sidebar of your IDE). The model used is `all-MiniLM-L6-v2`, which is shipped alongside the Continue extension and generates embeddings of size 384.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "transformers.js"
  }
}
```

### Ollama

[Ollama](https://ollama.ai) is the easiest way to get up and running with open-source language models. It provides an entirely local REST API for working with LLMs, including generating embeddings. The embeddings generated are slightly larger, with a size of 4096 for `codellama:7b`.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "codellama:7b",
    "apiBase": "http://localhost:11434" // optional, defaults to http://localhost:11434
  }
}
```

### OpenAI

OpenAI's [embeddings](https://platform.openai.com/docs/guides/embeddings) are high dimensional embeddings that give great performance on both text and code.

Configuration for text-embedding-3-small Model. This is default. 
The text-embedding-3-small model offers an outstanding balance between performance and efficiency, suitable for a versatile range of applications.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // optional, defaults to OpenAI's API
  }
}
```

Configuration for text-embedding-3-large Model
For those requiring the highest level of embedding detail and precision, the text-embedding-3-large model is the better choice.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // optional, defaults to OpenAI's API
  }
}
```

Legacy Model Configuration
For certain scenarios, you may still find the text-embedding-ada-002 model relevant. Below is the configuration example:

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiBase": "<your custom OpenAI-compatible endpoint>" // optional, defaults to OpenAI's API
  }
}
```

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
        })
      );
    },
  };

  return config;
}
```

## Customizing which files are indexed

Continue respects `.gitignore` files in order to determine which files should not be indexed. If you'd like to exclude additional files, you can add them to a `.continueignore` file, which follows the exact same rules as `.gitignore`.

If you want to see exactly what files Continue has indexed, the metadata is stored in `~/.continue/index/index.sqlite`. You can use a tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to view the `tags_catalog` table within this file.

If you need to force a refresh of the index, reload the VS Code window with `cmd/ctrl + shift + p` + "Reload Window".
