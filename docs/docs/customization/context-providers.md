---
title: Context Providers
description: Type '@' to select content to the LLM as context
keywords: [context, "@", provider, LLM]
---

# Context Providers

Context Providers allow you to type '@' and see a dropdown of content that can all be fed to the LLM as context. Every context provider is a plugin, which means if you want to reference some source of information that you don't see here, you can request (or build!) a new context provider.

As an example, say you are working on solving a new GitHub Issue. You type '@issue' and select the one you are working on. Continue can now see the issue title and contents. You also know that the issue is related to the files 'readme.md' and 'helloNested.py', so you type '@readme' and '@hello' to find and select them. Now these 3 "Context Items" are displayed inline with the rest of your input.

![Context Items](/img/context-provider-example.png)

## Built-in Context Providers

To use any of the built-in context providers, open `~/.continue/config.json` and add it to the `contextProviders` list.

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

### Exact Search

Type '@search' to reference the results of codebase search, just like the results you would get from VS Code search. This context provider is powered by [ripgrep](https://github.com/BurntSushi/ripgrep).

```json
{ "name": "search" }
```

### URLs

Type '@url' and then enter the URL you want to include in the input prompt that appears. The text contents of the page will be fetched and used as context.

```json
{
  "name": "url",
  "params": { "presetUrls": ["https://continue.dev/docs/customization"] }
}
```

### File Tree

Type '@tree' to reference the structure of your current workspace. The LLM will be able to see the nested directory structure of your project.

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

### GitHub Issues

Type '@issue' to reference the conversation in a GitHub issue. Make sure to include your own [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) to avoid being rate-limited:

```json
{
  "name": "issue",
  "params": {
    "repos": [
      {
        "owner": "continuedev",
        "repo": "continue"
      }
    ],
    "githubToken": "ghp_xxx"
  }
}
```

### Requesting Context Providers

Not seeing what you want? Create an issue [here](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) to request a new ContextProvider.

## Building Your Own Context Provider

> Currently custom context providers are only supported in VS Code, but are coming soon to JetBrains IDEs.

### Introductory Example

To write your own context provider, you just have to implement the `CustomContextProvider`
interface:

```typescript
interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]>;
}
```

As an example, let's say you have a set of internal documents that have been indexed in a vector database. You've set up a simple REST API that allows internal users to query and get back relevant snippets. This context provider will send the query to this server and return the results from the vector database.

```typescript
const RagContextProvider = {
  title: "rag",
  displayTitle: "RAG",
  description:
    "Retrieve snippets from our vector database of internal documents",

  getContextItems: async (query: string, extras: ContextProviderExtras) => {
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

No modification in `config.json` is necessary.

### Importing outside modules

> Context providers run in a NodeJS environment, but for the time being the `modifyConfig` function will be called both from NodeJS _and_ the browser. This means that if you are importing packages requiring NodeJS, you should dynamically import them inside of the context provider.

To include outside Node modules in your config.ts, run `npm install <module_name>` from the `~/.continue` directory, and then import them in config.ts.

Continue will use [esbuild](https://esbuild.github.io/) to bundle your `config.ts` and any dependencies into a single Javascript file. The exact configuration used can be found [here](https://github.com/continuedev/continue/blob/5c9874400e223bbc9786a8823614a2e501fbdaf7/extensions/vscode/src/ideProtocol.ts#L45-L52).

### `CustomContextProvider` Reference

- `title`: An identifier for the context provider
- `displayTitle` (optional): The title displayed in the dropdown
- `description` (optional): The longer description displayed in the dropdown when hovered
- `getContextItems`: A function that returns the documents to include in the prompt. It should return a list of `ContextItem`s, and is given access to the following arguments:
  - `extras.fullInput`: A string representing the user's full input to the text box. This can be used for example to generate an embedding to compare against a set of other embedded documents
  - `extras.embeddingsProvider`: The embeddings provider has an `embed` function that will convert text (such as `fullInput`) to an embedding
  - `extras.llm`: The current default LLM, which you can use to make completion requests
  - `extras.ide`: An instance of the `IDE` class, which lets you gather various sources of information from the IDE, including the contents of the terminal, the list of open files, or any warnings in the currently open file.
  - `query`: (not currently used) A string representing the query
