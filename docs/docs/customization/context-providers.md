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

### Documentation

Type `@docs` to index and retrieve snippets from any documentation site. You can add any site by selecting "Add Docs" in the dropdown, then entering the root URL of the documentation site and a title to remember it by. After the site has been indexed, you can type `@docs`, select your documentation from the dropdown, and Continue will use similarity search to automatically find important sections when answering your question.

```json
{ "name": "docs" }
```

### Open Files

Type '@open' to reference the contents of all of your open files. Set `onlyPinned` to `true` to only reference pinned files.

```json
{ "name": "open", "params": { "onlyPinned": true } }
```

### Codebase Retrieval

Type '@codebase' to automatically retrieve the most relevant snippets from your codebase. Read more about indexing and retrieval [here](../walkthroughs/codebase-embeddings.md).

```json
{ "name": "codebase" }
```

### Folders

Type '@folder' to use the same retrieval mechanism as '@codebase', but only on a single folder.

```json
{ "name": "folder" }
```

### Exact Search

Type '@search' to reference the results of codebase search, just like the results you would get from VS Code search. This context provider is powered by [ripgrep](https://github.com/BurntSushi/ripgrep).

```json
{ "name": "search" }
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

### Jira Issues

Type '@jira' to reference the conversation in a Jira issue. Make sure to include your own [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens).

```json
{
  "name": "issue",
  "params": {
    "domain": "company.atlassian.net",
    "email": "someone@somewhere.com",
    "token ": "ATATT..."
  }
}
```

#### Issue Query

By default, the following query will be used to find issues:

```jql
assignee = currentUser() AND resolution = Unresolved order by updated DESC
```

You can override this query by setting the `issueQuery` parameter.

### Code Outline

Type '@outline' to reference the outline of all currently open files. The outline of a files consists of only the function and class definitions in the file. Supported file extensions are '.js', '.mjs', '.go', '.c', '.cc', '.cs', '.cpp', '.el', '.ex', '.elm', '.java', '.ml', '.php', '.ql', '.rb', '.rs', '.ts'

```json
{ "name": "outline" }
```

### Code Highlights

Type '@highlights' to reference the 'highlights' from all currently open files. The highlights are computed using Paul Gauthier's so-called ['repomap'](https://aider.chat/docs/repomap.html) technique in [Aider Chat](https://github.com/paul-gauthier/aider). Supported file extensions are the same as for '@Outline' (behind the scenes, we use the corresponding tree-sitter grammars for language parsing).

```json
{ "name": "highlights" }
```

### PostgreSQL

Type `@postgres` to reference the schema of a table, and some sample rows. A dropdown will appear, allowing you to select a specific table, or all tables.

The only required settings are those for creating the database connection: `host`, `port`, `user`, `password`, and `database`.

By default, the `schema` filter is set to `public`, and the `sampleRows` is set to 3. You may unset the schema if you want to include tables from all schemas.

[Here is a short demo.](https://github.com/continuedev/continue/pull/859)

```json
{
  "name": "postgres",
  "params": {
    "host": "localhost",
    "port": 5436,
    "user": "myuser",
    "password": "catsarecool",
    "database": "animals",
    "schema": "public",
    "sampleRows": 3
  }
}
```

### Database Tables

Type `@database` to reference table schemas you can use the drop-down or start typeing table names based off of your configuration. Configuration supports multiple databases, allowing you to specify various connection details for PostgreSQL, MySQL, SQLite. Each connection should include a unique name, the connection_type (e.g., postgres, sqlite), and the necessary connection parameters specific to each database type.

```json
{
  "name": "database",
  "params": {
    "connections": [
      {
        "name": "examplePostgres",
        "connection_type": "postgres",
        "connection": {
          "user": "username",
          "host": "localhost",
          "database": "exampleDB",
          "password": "yourPassword",
          "port": 5432
        }
      },
      {
        "name": "exampleSqlite",
        "connection_type": "sqlite",
        "connection": {
          "filename": "/path/to/your/sqlite/database.db"
        }
      }
    ]
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

As an example, let's say you have a set of internal documents that have been indexed in a vector database. You've set up a simple REST API that allows internal users to query and get back relevant snippets. This context provider will send the query to this server and return the results from the vector database. The return type of `getContextItems` _must_ be an array of objects that have all of the following properties:

- `name`: The name of the context item, which will be displayed as a title
- `description`: A longer description of the context item
- `content`: The actual content of the context item, which will be fed to the LLM as context

```typescript title="~/.continue/config.ts"
const RagContextProvider: CustomContextProvider = {
  title: "rag",
  displayTitle: "RAG",
  description:
    "Retrieve snippets from our vector database of internal documents",

  getContextItems: async (
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> => {
    const response = await fetch("https://internal_rag_server.com/retrieve", {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    const results = await response.json();

    return results.map((result) => ({
      name: result.title,
      description: result.title,
      content: result.contents,
    }));
  },
};
```

It can then be added in `config.ts` like so:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  if (!config.contextProviders) {
    config.contextProviders = [];
  }
  config.contextProviders.push(RagContextProvider);
  return config;
}
```

No modification in `config.json` is necessary.

### Custom Context Providers with Submenu or Query

There are 3 types of context providers: "normal", "query", and "submenu". The "normal" type is the default, and is what we've seen so far.

The **"query"** type is used when you want to display a text box to the user, and then use the contents of that text box to generate the context items. Built-in examples include ["search"](#exact-search) and ["google"](#google). This text is what gets passed to the "query" argument in `getContextItems`. To implement a "query" context provider, simply set `"type": "query"` in your custom context provider object.

The **"submenu"** type is used when you want to display a list of searchable items in the dropdown. Built-in examples include ["issue"](#github-issues) and ["folder"](#folders). To implement a "submenu" context provider, set `"type": "submenu"` and implement the `loadSubmenuItems` and `getContextItems` functions. Here is an example that shows a list of all README files in the current workspace:

```typescript title="~/.continue/config.ts"
const ReadMeContextProvider: CustomContextProvider = {
  title: "readme",
  displayTitle: "README",
  description: "Reference README.md files in your workspace",
  type: "submenu",

  getContextItems: async (
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> => {
    // 'query' is the filepath of the README selected from the dropdown
    const content = await extras.ide.readFile(query);
    return [
      {
        name: getFolder(query),
        description: getFolderAndBasename(query),
        content,
      },
    ];
  },

  loadSubmenuItems: async (
    args: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]> => {
    // Filter all workspace files for READMEs
    const allFiles = await args.ide.listWorkspaceContents();
    const readmes = allFiles.filter((filepath) =>
      filepath.endsWith("README.md")
    );

    // Return the items that will be shown in the dropdown
    return readmes.map((filepath) => {
      return {
        id: filepath,
        title: getFolder(filepath),
        description: getFolderAndBasename(filepath),
      };
    });
  },
};

export function modifyConfig(config: Config): Config {
  if (!config.contextProviders) {
    config.contextProviders = [];
  }
  config.contextProviders.push(ReadMeContextProvider);
  return config;
}

function getFolder(path: string): string {
  return path.split(/[\/\\]/g).slice(-2)[0];
}

function getFolderAndBasename(path: string): string {
  return path
    .split(/[\/\\]/g)
    .slice(-2)
    .join("/");
}
```

The flow of information in the above example is as follows:

1. The user types `@readme` and selects it from the dropdown, now displaying the submenu where they can search for any item returned by `loadSubmenuItems`.
2. The user selects one of the READMEs in the submenu, enters the rest of their input, and presses enter.
3. The `id` of the chosen `ContextSubmenuItem` is passed to `getContextItems` as the `query` argument. In this case it is the filepath of the README.
4. The `getContextItems` function can then use the `query` to retrieve the full contents of the README and format the content before returning the context item which will be included in the prompt.

### Importing outside modules

To include outside Node modules in your config.ts, run `npm install <module_name>` from the `~/.continue` directory, and then import them in config.ts.

Continue will use [esbuild](https://esbuild.github.io/) to bundle your `config.ts` and any dependencies into a single Javascript file. The exact configuration used can be found [here](https://github.com/continuedev/continue/blob/5c9874400e223bbc9786a8823614a2e501fbdaf7/extensions/vscode/src/ideProtocol.ts#L45-L52).

### `CustomContextProvider` Reference

- `title`: An identifier for the context provider
- `displayTitle` (optional): The title displayed in the dropdown
- `description` (optional): The longer description displayed in the dropdown when hovered
- `type` (optional): The type of context provider. Options are "normal", "query", and "submenu". Defaults to "normal".
- `getContextItems`: A function that returns the documents to include in the prompt. It should return a list of `ContextItem`s, and is given access to the following arguments:
  - `extras.fullInput`: A string representing the user's full input to the text box. This can be used for example to generate an embedding to compare against a set of other embedded documents
  - `extras.embeddingsProvider`: The embeddings provider has an `embed` function that will convert text (such as `fullInput`) to an embedding
  - `extras.llm`: The current default LLM, which you can use to make completion requests
  - `extras.ide`: An instance of the `IDE` class, which lets you gather various sources of information from the IDE, including the contents of the terminal, the list of open files, or any warnings in the currently open file.
  - `query`: (not currently used) A string representing the query
- `loadSubmenuItems` (optional): A function that returns a list of `ContextSubmenuItem`s to display in a submenu. It is given access to an `IDE`, the same that is passed to `getContextItems`.
