---
description: Learn how to access and search your project's documentation directly within Continue
keywords:
  [
    documentation,
    indexing,
    context provider,
    embeddings,
    docs,
    embedder,
    embeddings provider,
    documentation,
  ]
toc_max_heading_level: 5
---

# @Docs

The [`@Docs` context provider](customize/context-providers.md#docs) allows you to efficiently reference locally-indexed documentation directly within Continue.

## Enabling the `@Docs` context provider

To enable the `@Docs` context provider, add it to the list of context providers in your `config.json` file.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs"
    }
  ]
}
```

## How It Works

The `@Docs` context provider works by

1. Crawling specified documentation sites
2. Generating embeddings for the chunked content
3. Storing the embeddings locally on your machine
4. Embedding chat input to include similar documentation chunks as context

## Pre-indexed Documentation Sites

In VS Code, Continue offers a selection of pre-indexed documentation sites for popular frameworks and libraries. You can view the list of [available pre-indexed sites and request additions here](https://github.com/continuedev/continue/blob/main/core/indexing/docs/preIndexedDocs.ts).

Pre-indexed docs are only available in VS Code because the VS Code extension ships with the Transformers.js embedder built in, while Jetbrains currently does not. You can override a pre-indexed doc to index it with your own embeddings provider by adding it to your config (unique by `startUrl`). Otherwise, it will always use Transformers.js for queries.

## Indexing Your Own Documentation

### Through the `@Docs` Context Provider

To add a single documentation site, we recommend using the **Add Documentation** Form within the GUI. This can be accessed

- from the `@Docs` context provider - type `@Docs` in the chat, hit `Enter`, and search for `Add Docs`
- from the `More` page (three dots icon) in the `@docs indexes` section
  the `@Docs` context provider.

In the **Add Documentation** Form, enter a `Title` and `Start URL` for the site.

- `Title`: The name of the documentation site, used for identification in the UI
- `Start URL`: The URL where the indexing process should begin.

Indexing will begin upon submission. Progress can be viewed in the form or later in the `@docs indexes` section of the `More` page.

Documentation sources may be suggested based on package files in your repo. This currently works for Python `requirements.txt` files and Node.js (Javascript/Typescript) `package.json` files.

- Packages with a valid documentation URL (with a `+` icon) can be clicked to immediately kick off indexing
- Packages with partial information (with a pen icon) can be clicked to fill the form with the available information
- Note that you can hover over the information icon to see where the package suggestion was found.

![Add documentation form](/img/docs-form.png)

### Through global configuration

For bulk documentation site adds or edits, we recommend editing your global configuration file directly. Documentation sites are stored in an array within `docs` in your global configuration, as follows:

```json title="config.json"
{
  "docs": [
    {
      "title": "Nest.js",
      "startUrl": "https://docs.nestjs.com/",
      "faviconUrl": "https://docs.nestjs.com/favicon.ico"
    }
  ]
}
```

See [the config reference](../../reference) for all documentation site configuration options.

Indexing will re-sync upon saving the configuration file.

## Configuration

### Using Your Embeddings Provider

If you have set up an [embeddings provider](../model-types/embeddings.md), @docs will use your embeddings provider. Switching embeddings providers will trigger a re-index of all documentation sites in your configuration.

### Reranking

As with [@Codebase context provider configuration](./codebase#configuration), you can adjust the reranking behavior of the `@Docs` context provider with the `nRetrieve`, `nFinal`, and `useReranking`.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs",
      "params": {
        "nRetrieve": 25, // The number of docs to retreive from the embeddings query
        "nFinal": 5, // The number of docs chunks to return IF reranking
        "useReranking": true // use reranking if a reranker is configured (defaults to true)
      }
    }
  ]
}
```

### Github

The Github API rate limits public requests to 60 per hour. If you want to reliably index Github repos, you can add a github token to your config file:

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs",
      "params": {
        "githubToken": "github_..."
      }
    }
  ]
}
```

### Local Crawling

By default, Continue crawls documentation sites using a specialized crawling service that provides the best experience for most users and documentation sites.

If your documentation is private, you can skip the default crawler and use a local crawler instead by setting `useLocalCrawling` to `true`.

```json title="config.json"
{
  "docs": [
    {
      "title": "My Private Docs",
      "startUrl": "http://10.2.1.2/docs",
      "faviconUrl": "http://10.2.1.2/docs/assets/favicon.ico",
      "useLocalCrawling": true
    }
  ]
}
```

The default local crawler is a lightweight tool that cannot render sites that are dynamically generated using JavaScript. If your sites need to be rendered, you can enable the experimental `useChromiumForDocsCrawling` feature in your `config.json`. This will download and install Chromium to `~/.continue/.utils`, and use it as the local crawler.

```json title="config.json"
"experimental": {
    "useChromiumForDocsCrawling": true
}
```

Further notes:

- If the site is only locally accessible, the default crawler will fail anyways and fall back to the local crawler. `useLocalCrawling` is especially useful if the URL itself is confidential.
- For Github Repos this has no effect because only the Github Crawler will be used, and if the repo is private it can only be accessed with a priveleged Github token anyways.

## Managing your docs indexes

You can view indexing statuses and manage your documentation sites from the `@docs indexes` section of the `More` page (three dots)

- Continue does not automatically re-index your docs. Use `Click to re-index` to trigger a reindex for a specific source
- While a site is indexing, click `Cancel indexing` to cancel the process
- Failed indexing attempts will show an error status bar and icon
- Delete a documentation site from your configuration using the trash icon

![More Page @docs indexes section](/img/docs-indexes.png)

You can also view the overall status of currently indexing docs from a hideable progress bar at the bottom of the chat page
![Documentation indexing peek](/img/docs-indexing-peek.png)

You can also use the following IDE command to force a re-index of all docs: `Continue: Docs Force Re-Index`.

## Examples

### VS Code minimal setup

The following configuration example works out of the box for VS Code. This uses the built-in embeddings provider with no reranking. Pre-indexed docs will be accessible.

```json title="config.json"
  "contextProviders": [
    {
      "name": "docs",
    }
  ],
  "docs": [
    {
      "title": "Nest.js",
      "startUrl": "https://docs.nestjs.com/",
    },
  ],
```

### Jetbrains minimal setup

Here is the equivalent minimal example for Jetbrains, which requires setting up an [embeddings provider](../model-types/embeddings.md). Pre-indexed docs will _not_ be accessible.

```json title="config.json"
  "contextProviders": [
    {
      "name": "docs",
    }
  ],
  "docs": [
    {
      "title": "Nest.js",
      "startUrl": "https://docs.nestjs.com/",
    },
  ],
  "embeddingsProvider": {
    "provider": "lmstudio",
    "model": "nomic-ai/nomic-embed-text-v1.5-GGUF"
  },
```

### Full-power setup (VS Code or Jetbrains)

The following configuration example includes:

- Examples of both public and private documentation sources
- A custom embeddings provider
- A reranker model available, with reranking parameters customized
- A Github token to enable Github crawling
- Chromium enabled as a backup for private documentation

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs",
      "params": {
        "githubToken": "github_...",
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ],
  "docs": [
    {
      "title": "Nest.js",
      "startUrl": "https://docs.nestjs.com/"
    },
    {
      "title": "My Private Docs",
      "startUrl": "http://10.2.1.2/docs",
      "faviconUrl": "http://10.2.1.2/docs/assets/favicon.ico",
      "maxDepth": 4,
      "useLocalCrawling": true
    }
  ],
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  },
  "embeddingsProvider": {
    "provider": "lmstudio",
    "model": "nomic-ai/nomic-embed-text-v1.5-GGUF"
  },
  "experimental": {
    "useChromiumForDocsCrawling": true
  }
}
```
