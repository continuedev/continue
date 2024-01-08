---
title: Context Providers
description: Type '@' to select content to the LLM as context
keywords: [context, "@", provider, LLM]
---

# Context Providers

Context Providers allow you to type '@' and see a dropdown of content that can all be fed to the LLM as context. Every context provider is a plugin, which means if you want to reference some source of information that you don't see here, you can request (or build!) a new context provider.

As an example, say you are working on solving a new GitHub Issue. You type '@issue' and select the one you are working on. Continue can now see the issue title and contents. You also know that the issue is related to the files 'readme.md' and 'helloNested.py', so you type '@readme' and '@hello' to find and select them. Now these 3 "Context Items" are displayed above the input.

![Context Items](/img/context-provider-example.png)

When you enter your next input, Continue will see the full contents of each of these items, and can use them to better answer your questions throughout the conversation.

## Built-in Context Providers

To use any of the built-in context providers, open `~/.continue/config.json` (can do this with the '/config' slash command) and add it to the `contextProviders` list.

### Git Diff

Type '@diff' to reference all of the changes you've made to your current branch. This is useful if you want to summarize what you've done or ask for a general review of your work before committing.

```json
{ "name": "diff" }
```

### Terminal

Type '@terminal' to reference the contents of your IDE's terminal.

```json
{ "name": "terminal" }
```

### Open Files

Type '@open' to reference the contents of all of your open files.

```json
{ "name": "open" }
```

### Codebase Search

Type '@search' to reference the results of codebase search, just like the results you would get from VS Code search.

```json
{ "name": "search" }
```

### URLs

Type '@url' to reference the contents of a URL. You can either reference preset URLs, or reference one dynamically by typing '@url https://example.com'. The text contents of the page will be fetched and used as context.

```json
{
  "name": "url",
  "params": { "presetUrls": ["https://continue.dev/docs/customization"] }
}
```

### File Tree

Type '@tree' to reference the contents of your current workspace. The LLM will be able to see the nested directory structure of your project.

```json
{ "name": "tree" }
```

### Google

Type '@google' to reference the results of a Google search. For example, type "@google python tutorial" if you want to search and discuss ways of learning Python.

```json
{
  "name": "google",
  "params": { "serperApiKey": "<your serper.dev api key>" }
}
```

Note: You can get an API key for free at [serper.dev](https://serper.dev).

### GitHub

Type '@issue' to reference the title and contents of a GitHub issue.

```json
{
  "name": "github",
  "params": {
    // Change to whichever repo you want to use
    "repoName": "continuedev/continue",
    "authToken": "<my_github_auth_token>"
  }
}
```

### Requesting Context Providers

Not seeing what you want? Create an issue [here](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) to request a new ContextProvider.

## Building Your Own Context Provider

### Introductory Example

To write your own context provider, you just have to implement the `CustomContextProvider`
interface:

```typescript
interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  getContextItems(query: string): Promise<ContextItem[]>;
}
```

As an example, let's say you have a set of internal documents that have been indexed in a vector database. You've set up a simple REST API that allows internal users to query and get back relevant snippets. This context provider will send the query to this server and return the results from the vector database.

```typescript
const RagContextProvider = {
  title: "rag",
  displayTitle: "RAG",
  description:
    "Retrieve snippets from our vector database of internal documents",

  getContextItems: async (query: string) => {
    const response = await fetch("https://internal_rag_server.com/retrieve", {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    const results = await response.json();

    return results.map((result) => ({
      title: result.title,
      description: result.title,
      content: result.contents,
    }));
  },
};
```

It can then be added in `config.ts` like so:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.contextProviders.append(RagContextProvider);
  return config;
}
```
