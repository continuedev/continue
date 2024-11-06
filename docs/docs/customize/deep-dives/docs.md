---
description: Learn how to access and search your project's documentation directly within Continue
keywords: [documentation, indexing, context provider, embeddings, docs]
toc_max_heading_level: 5
---

# @Docs

The [`@Docs` context provider](customize/context-providers.md#docs) allows you to interact with your documentation directly within Continue. This feature enables you to index any static site or GitHub markdown pages, making it easier to access and utilize your documentation while coding.

## Enabling the `@Docs` context provider

To enable the `@Docs` context provider, you need to add it to the list of context providers in your `config.json` file.

```json
{
  "contextProviders": [
    {
      "name": "docs"
    }
  ]
}
```

## How It Works

The `@Docs` context provider works by crawling specified documentation sites, generating embeddings, and storing them locally for you. This process allows for quick and efficient access to your documentation content.

1. We crawl the specified documentation site
2. Generate embeddings for the content
3. Store the embeddings locally on your machine
4. Provide access to the indexed content through the `@Docs` context provider

## Pre-indexed Documentation Sites

We offer a selection of pre-indexed documentation sites for popular frameworks and libraries. You can view the list of [available pre-indexed sites and request additions here](https://github.com/continuedev/continue/blob/main/core/indexing/docs/preIndexedDocs.ts).

## Indexing Your Own Documentation

### Through the `@Docs` Context Provider

To add a single documentation site, we recommend using the `@Docs` context provider.

1. Type `@Docs` in the chat panel, hit enter
2. Type "add" and select the "Add Docs" option
3. Enter the required information into the dialog

Indexing will begin upon submission.

### Through `config.json`

To add multiple documentation sites, we recommend adding them in bulk to your `config.json` file. Indexing will kick off upon file save.

The [configuration schema for docs](https://github.com/continuedev/continue/blob/v0.9.212-vscode/extensions/vscode/config_schema.json#L1943-L1973) is as follows:

```json
"docs": [
    {
    "title": "Continue",
    "startUrl": "https://docs.continue.dev/intro",
    "rootUrl": "https://docs.continue.dev",
    "faviconUrl": "https://docs.continue.dev/favicon.ico",
  }
]
```

- `title`: The name of the documentation site, used for identification in the UI.
- `startUrl`: The URL where the indexing process should begin.
- `rootUrl`: The base URL of the documentation site, used to determine which pages to index.
- `faviconUrl`: The URL of the site's favicon, used for visual identification in the UI.

## Configuration

As with [@Codebase context provider configuration](https://docs.continue.dev/customize/deep-dives/codebase#configuration), you can adjust the behavior of the docs context provider with the `nRetrieve`, `nFinal`, and `useReranking`

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs",
      "params": {
        "nRetrieve": 25,
        "nFinal": 5,
        "useReranking": true
      }
    }
  ]
}
```

## Crawling dynamically generated sites with `useChromiumForDocsCrawling`

By default, we use a lighter weight tool to crawl documentation sites that cannot render sites that are dynamically generated using JavaScript.

If you want to crawl a site that is dynamically generated, or you get an error while attempting to crawl a site, you can enable the experimental `useChromiumForDocsCrawling` feature in your `config.json`. This will download and install Chromium to `~/.continue/.utils`.

```json title="config.json"
"experimental": {
    "useChromiumForDocsCrawling": true
}
```

## FAQ

### How often is the indexed content updated?

Currently we do not automatically re-index your docs. If you would like to force a re-index, you can use the following command: `Continue: Docs Force Re-Index`.
