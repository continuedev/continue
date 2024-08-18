---
title: Continue Fundaments
description: How to use Llama 3.1 with Continue
keywords: [llama, meta, togetherai, ollama, replicate]
---

The document aims to cover fundamental topics about the Continue AI code assistant. Here’s a broader explanation of some core concepts related to Continue that might provide the foundational knowledge you are looking for:

### Core Concepts

#### Large Language Model (LLM) Providers

LLM providers are services that supply access to large pre-trained language models, such as Llama 3.1. These models can perform a wide range of natural language processing tasks. Common LLM providers include:

- **Ollama**: A platform that allows you to run language models locally on your machine.
- **Together AI**: A service for running open-source models with good performance.
- **Replicate**: A platform for deploying and running models via API.
- **OpenAI, Anthropic**, and others: Providers of commercial LLMs that offer powerful, cloud-based language models via API.

#### Context Providers

Context providers enhance the AI's ability to understand code by supplying additional information from your project and environment. This can include:

- **File context**: The current file or open files in your IDE.
- **Project context**: Additional files and their structures within your project.
- **Documentation context**: Relevant documentation or comments to improve understanding and relevance.
- **Dynamic context**: Real-time information such as terminal outputs or debug logs.

Continue allows you to customize how context is gathered and presented to the language model to make it as relevant as possible.

#### Configuration (config.json)

Configuration in Continue is handled via a `config.json` file, typically located in `~/.continue/`. This file allows you to specify settings such as:

- **Model Setup**: Define the models you intend to use, their providers, and any specific parameters.

  ```json
  "models": [
      {
          "title": "Llama 3.1 8b",
          "provider": "ollama",
          "model": "llama3.1-8b"
      }
  ]
  ```

- **Tab Autocomplete Model**: Specify a model for autocomplete functionality.

  ```json
  "tabAutocompleteModel": {
      "title": "Starcoder 2 3b",
      "provider": "ollama",
      "model": "starcoder2:3b"
  }
  ```

- **Embeddings Provider**: Define how text is converted into embeddings, critical for context understanding and semantic search.

  ```json
  "embeddingsProvider": {
      "provider": "ollama",
      "model": "nomic-embed-text"
  }
  ```

#### Code Indexing

Code indexing is the process of parsing and storing structured information about your codebase. This can involve:

- **Building an index**: Scanning files to create a searchable database of functions, classes, variables, and other elements.
- **Updating the index**: Keeping the database in sync with changes in your codebase.
- **Leveraging the index**: Using the indexed data to power features like code navigation, auto-completion, refactoring suggestions, and more.

Continue uses code indexing to provide smart, context-aware assistance by understanding the structure and components of your codebase.

#### Combining Concepts

- **Configuration and Providers**: Set up your `config.json` to specify models from different providers based on your requirements.
- **Context Usage**: Customize context providers to make sure the AI gets the most relevant information during coding sessions.
- **Code Indexing**: Ensure your codebase is indexed to exploit all of Continue’s advanced coding features effectively.

### Further Reading

To delve deeper into these concepts, you might want to explore specific sections in the documentation related to:

- **Setting Up LLM Providers**: Information on various providers and related configurations.
- **Customizing Context Providers**: Methods for fine-tuning how context is gathered and used.
- **Configuring Continue**: Detailed guide on setting up and modifying `config.json`.
- **Understanding Code Indexing**: Exploring how indexing works and how to configure it for your projects.

These topics collectively form the foundational knowledge necessary for effectively using Continue with Llama 3.1 or any other supported language model.
