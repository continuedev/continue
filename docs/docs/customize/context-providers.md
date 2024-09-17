---
title: Context providers
description: Type '@' to select content to the LLM as context
keywords: [context, "@", provider, LLM]
---

Context Providers allow you to type '@' and see a dropdown of content that can all be fed to the LLM as context. Every context provider is a plugin, which means if you want to reference some source of information that you don't see here, you can request (or build!) a new context provider.

As an example, say you are working on solving a new GitHub Issue. You type '@issue' and select the one you are working on. Continue can now see the issue title and contents. You also know that the issue is related to the files 'readme.md' and 'helloNested.py', so you type '@readme' and '@hello' to find and select them. Now these 3 "Context Items" are displayed inline with the rest of your input.

![Context Items](/img/context-provider-example.png)

## Built-in Context Providers

To use any of the built-in context providers, open `~/.continue/config.json` and add it to the `contextProviders` list.

### Files

Type '@file' to reference any file in your current workspace.

```json
{ "name": "file" }
```

### Code

Type '@code' to reference specific functions or classes from throughout your project.

```json
{ "name": "code" }
```

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

Type `@docs` to index and retrieve snippets from any documentation site.

```json
{ "name": "docs" }
```

To learn more, visit `[@docs](customize/deep-dives/docs.md)`.

### Open Files

Type '@open' to reference the contents of all of your open files. Set `onlyPinned` to `true` to only reference pinned files.

```json
{ "name": "open", "params": { "onlyPinned": true } }
```

### Codebase Retrieval

Type '@codebase' to automatically retrieve the most relevant snippets from your codebase. Read more about indexing and retrieval [here](customize/deep-dives/codebase.md).

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

### URL

Type '@url' and input a URL, then Continue will convert it to a markdown document to pass to the model.

```json
{ "name": "url" }
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

### GitLab Merge Request

Type `@gitlab-mr` to reference an open MR for this branch on GitLab.

#### Configuration

You will need to create a [personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) with the `read_api` scope. then add the following to your configuration:

```json
{
  "name": "gitlab-mr",
  "params": {
    "token": "..."
  }
}
```

#### Using Self-Hosted GitLab

You can specify the domain to communicate with by setting the `domain` parameter in your configurtion. By default this is set to `gitlab.com`.

```json
{
  "name": "gitlab-mr",
  "params": {
    "token": "...",
    "domain": "gitlab.example.com"
  }
}
```

#### Filtering Comments

If you select some code to be edited, you can have the context provider filter out comments for other files. To enable this feature, set `filterComments` to `true`.

### Jira Issues

Type '@jira' to reference the conversation in a Jira issue. Make sure to include your own [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens), or use your `email` and `token`, with token set to your password for basic authentication. If you use your own Atlassian API Token, don't configure your email.

```json
{
  "name": "jira",
  "params": {
    "domain": "company.atlassian.net",
    "token ": "ATATT..."
  }
}
```

#### Jira Datacenter Support

This context provider supports both Jira API version 2 and 3. It will use version 3 by default since
that's what the cloud version uses, but if you have the datacenter version of Jira, you'll need
to set the API Version to 2 using the `apiVersion` property.

```json
  "params": {
    "apiVersion": "2",
    ...
  }
```

#### Issue Query

By default, the following query will be used to find issues:

```jql
assignee = currentUser() AND resolution = Unresolved order by updated DESC
```

You can override this query by setting the `issueQuery` parameter.

 <!-- 
 Note: We are currently omitting the following providers due to bugs.
 See this issue for details: https://github.com/continuedev/continue/issues/1365 
 -->

<!-- ### Code Outline

Type '@outline' to reference the outline of all currently open files. The outline of a files consists of only the function and class definitions in the file. Supported file extensions are '.js', '.mjs', '.go', '.c', '.cc', '.cs', '.cpp', '.el', '.ex', '.elm', '.java', '.ml', '.php', '.ql', '.rb', '.rs', '.ts'

```json
{ "name": "outline" }
```

### Code Highlights

Type '@highlights' to reference the 'highlights' from all currently open files. The highlights are computed using Paul Gauthier's so-called ['repomap'](https://aider.chat/docs/repomap.html) technique in [Aider Chat](https://github.com/paul-gauthier/aider). Supported file extensions are the same as for '@Outline' (behind the scenes, we use the corresponding tree-sitter grammars for language parsing).

```json
{ "name": "highlights" }
``` -->

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

### Debugger: Local Variables

Type `@locals` to reference the contents of the local variables with top n level (defaulting to 3) of call stack for that thread. A dropdown will appear, allowing you to select a specific thread to see the local variables in that thread.

```json
{
  "name": "locals",
  "params": {
    "stackDepth": 3
  }
}
```

### Repository map

Provides an overview of all files and the call signatures of top-level classes, functions, and methods. This helps the model better understand how a particular piece of code relates to the rest of the codebase.

This context provider is inpsired by [Aider's repository map](https://aider.chat/2023/10/22/repomap.html).

```json
{
  "name": "repo-map"
}
```

### Operating System

Type `@os` to reference the architecture and platform of your current operating system.

```json
{ "name": "os" }
```

### Requesting Context Providers

Not seeing what you want? Create an issue [here](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) to request a new ContextProvider.
