---
title: Talk To Your Docs
description: Learn how to access and search your project's documentation directly within Continue
keywords: [documentation, indexing, context provider, embeddings]
toc_max_heading_level: 5
---

The [`@docs` context provider](http://localhost:3000/customization/context-providers#documentation) allows you to interact with your documentation directly within Continue. This feature enables you to index any static site or GitHub markdown pages, making it easier to access and utilize your documentation while coding.

## Enabling the `@docs` context provider

To enable the `@docs` context provider, you need to add it to the list of context providers in your `config.json` file.

```json
{
    "contextProviders": [
        { "name": "docs" }
        ...
    ]
}
```

## How It Works

The `@docs` context provider works by crawling specified documentation sites, generating embeddings, and storing them locally for you. This process allows for quick and efficient access to your documentation content.

1. We crawl the specified documentation site
2. Generate embeddings for the content
3. Store the embeddings locally on your machine
4. Provide access to the indexed content through the `@docs` context provider

## Pre-indexed Documentation Sites

We offer a selection of pre-indexed documentation sites for popular frameworks and libraries. You can view the list of [available pre-indexed sites and request additions here](https://github.com/continuedev/continue/blob/main/core/indexing/docs/preIndexedDocs.ts).

## Indexing Your Own Documentation

### Through the `@docs` Context Provider

To add a single documentation site, we recommend going through the `@docs` context provider.

1. Type `@docs` in the chat panel, hit enter
2. Type "add" and select the "Add Docs" option
3. Enter the required information into the dialog

Indexing will begin upon submission.

### Through `config.json`

To add multiple documentation sites, we recommend adding them in bulk to your `config.json` file. Indexing will kick off upon file save.

The configuration schema is as follows:

```json
"docs": [
    {
    "title": "Continue",
    "startUrl": "https://docs.continue.dev/intro",
    "rootUrl": "https://docs.continue.dev",
    "faviconUrl": "https://docs.continue.dev/favicon.ico",
    "maxDepth": 3
  }
]
```

- `title`: The name of the documentation site, used for identification in the UI.
- `startUrl`: The URL where the indexing process should begin.
- `rootUrl`: The base URL of the documentation site, used to determine which pages to index.
- `faviconUrl`: The URL of the site's favicon, used for visual identification in the UI.
- `maxDepth`: The maximum number of levels deep the indexer should crawl from the start URL.

## FAQ

### Why did my documentation site fail to index?

Our current crawler is designed to work with static websites and may encounter issues with dynamic or JavaScript-heavy sites. If your documentation site failed to index, it's possible that it contains non-static elements that our crawler couldn't process.

If you're experiencing issues with indexing a documentation site, please let us know. We're continuously improving our indexing capabilities and would appreciate your feedback to help us enhance the feature.

<a href="https://discord.com/channels/1108621136150929458/1156679146932535376" className="button button--primary">Report Indexing Issues on Discord</a>

### How often is the indexed content updated?

Currently we do not automatically re-index your docs. If you would like to force a re-index, you can use the following command: `Continue: Docs Force Re-Index`.
