---
title: Context providers
description: Type '@' to select content to the LLM as context
keywords: [context, "@", provider, LLM]
---

Context Providers allow you to type '@' and see a dropdown of content that can all be fed to the LLM as context. Every context provider is a plugin, which means if you want to reference some source of information that you don't see here, you can request (or build!) a new context provider.

As an example, say you are working on solving a new GitHub Issue. You type '@Issue' and select the one you are working on. Continue can now see the issue title and contents. You also know that the issue is related to the files 'readme.md' and 'helloNested.py', so you type '@readme' and '@hello' to find and select them. Now these 3 "Context Items" are displayed inline with the rest of your input.

![Context Items](/img/context-provider-example.png)

## Built-in Context Providers

To use any of the built-in context providers, open `config.json` and add it to the `contextProviders` list.

### `@File`

Reference any file in your current workspace.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "file"
    }
  ]
}
```

### `@Code`

Reference specific functions or classes from throughout your project.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "code"
    }
  ]
}
```

### `@Git Diff`

Reference all of the changes you've made to your current branch. This is useful if you want to summarize what you've done or ask for a general review of your work before committing.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "diff"
    }
  ]
}
```

### `@Terminal`

Reference the last command you ran in your IDE's terminal and its output.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "terminal"
    }
  ]
}
```

### `@Docs`

Reference the contents from any documentation site.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs"
    }
  ]
}
```

Note that this will only enable the `@Docs` context provider.

To use it, you need to add a documentation site to your `config.json`. See the [docs](../customize/deep-dives/docs.md) page for more information.

### `@Open`

Reference the contents of all of your open files. Set `onlyPinned` to `true` to only reference pinned files.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "open",
      "params": {
        "onlyPinned": true
      }
    }
  ]
}
```

### `@Web`

Reference relevant pages from across the web, automatically determined from your input.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "web"
    }
  ]
}
```

### `@Codebase`

Reference the most relevant snippets from your codebase.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "codebase"
    }
  ]
}
```

Read more about indexing and retrieval [here](../customize/deep-dives/codebase.md).

### `@Folder`

Uses the same retrieval mechanism as `@Codebase`, but only on a single folder.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "folder"
    }
  ]
}
```

### `@Search`

Reference the results of codebase search, just like the results you would get from VS Code search.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "search"
    }
  ]
}
```

This context provider is powered by [ripgrep](https://github.com/BurntSushi/ripgrep).

### `@Url`

Reference the markdown converted contents of a given URL.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "url"
    }
  ]
}
```

### `@Tree`

Reference the structure of your current workspace.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "tree"
    }
  ]
}
```

### `@Google`

Reference the results of a Google search.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "google",
      "params": {
        "serperApiKey": "<your serper.dev api key>"
      }
    }
  ]
}
```

For example, type "@Google python tutorial" if you want to search and discuss ways of learning Python.

Note: You can get an API key for free at [serper.dev](https://serper.dev).

### `@Issue`

Reference the conversation in a GitHub issue.

```json title="config.json"
{
  "contextProviders": [
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
  ]
}
```

Make sure to include your own [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) to avoid being rate-limited.

### `@Gitlab Merge Request`

Reference an open MR for this branch on GitLab.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "gitlab-mr",
      "params": {
        "token": "..."
      }
    }
  ]
}
```

You will need to create a [personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) with the `read_api` scope.

#### Using Self-Hosted GitLab

You can specify the domain to communicate with by setting the `domain` parameter in your configurtion. By default this is set to `gitlab.com`.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "gitlab-mr",
      "params": {
        "token": "...",
        "domain": "gitlab.example.com"
      }
    }
  ]
}
```

#### Filtering Comments

If you select some code to be edited, you can have the context provider filter out comments for other files. To enable this feature, set `filterComments` to `true`.

### `@Jira`

Reference the conversation in a Jira issue.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "jira",
      "params": {
        "domain": "company.atlassian.net",
        "token ": "ATATT..."
      }
    }
  ]
}
```

Make sure to include your own [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens), or use your `email` and `token`, with token set to your password for basic authentication. If you use your own Atlassian API Token, don't configure your email.

#### Jira Datacenter Support

This context provider supports both Jira API version 2 and 3. It will use version 3 by default since
that's what the cloud version uses, but if you have the datacenter version of Jira, you'll need
to set the API Version to 2 using the `apiVersion` property.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "jira",
      "params": {
        "apiVersion": "2"
      }
    }
  ]
}
```

#### Issue Query

By default, the following query will be used to find issues:

```jql
assignee = currentUser() AND resolution = Unresolved order by updated DESC
```

You can override this query by setting the `issueQuery` parameter.

### `@Discord`

Reference the messages in a Discord channel.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "discord",
      "params": {
        "discordKey": "bot token",
        "guildId": "1234567890",
        "channels": [
          {
            "id": "123456",
            "name": "example-channel"
          },
          {
            "id": "678901",
            "name": "example-channel-2"
          }
        ]
      }
    }
  ]
}
```

Make sure to include your own [Bot Token](https://discord.com/developers/applications), and join it to your related server . If you want more granular control over which channels are searched, you can specify a list of channel IDs to search in. If you don't want to specify any channels, just include the guild id(Server ID) and all channels will be included. The provider only reads text channels.

### `@Postgres`

Reference the schema of a table, and some sample rows

```json title="config.json"
{
  "contextProviders": [
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
  ]
}
```

The only required settings are those for creating the database connection: `host`, `port`, `user`, `password`, and `database`.

By default, the `schema` filter is set to `public`, and the `sampleRows` is set to 3. You may unset the schema if you want to include tables from all schemas.

[Here is a short demo.](https://github.com/continuedev/continue/pull/859)

### `@Database`

Reference table schemas from Sqlite, Postgres, and MySQL databases.

```json title="config.json"
{
  "contextProviders": [
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
  ]
}
```

Each connection should include a unique name, the `connection_type`, and the necessary connection parameters specific to each database type.

Available connection types:

- `postgres`
- `mysql`
- `sqlite`

### `@Debugger`

Reference the contents of the local variables in the debugger.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "debugger",
      "params": {
        "stackDepth": 3
      }
    }
  ]
}
```

Uses the top _n_ levels (defaulting to 3) of the call stack for that thread.

### `@Repository Map`

Reference the outline of your codebase.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "repo-map"
    }
  ]
}
```

Provides a list of files and the call signatures of top-level classes, functions, and methods in those files. This helps the model better understand how a particular piece of code relates to the rest of the codebase.

In the submenu that appears, you can select either `Entire codebase`, or specify a subfolder to generate the repostiory map from.

This context provider is inpsired by [Aider's repository map](https://aider.chat/2023/10/22/repomap.html).

### `@Operating System`

Reference the architecture and platform of your current operating system.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "os"
    }
  ]
}
```

### `@HTTP`

The HttpContextProvider makes a POST request to the url passed in the configuration. The server must return 200 OK with a ContextItem object or an array of ContextItems.

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "http",
      "params": {
        "url": "https://api.example.com/v1/users"
      }
    }
  ]
}
```

The receiving URL should expect to receive the following parameters:

```json title="POST parameters"
{
  query: string,
  fullInput: string
}
```

The response 200 OK should be a JSON object with the following structure:

```json title="Response"
[
  {
    "name": "",
    "description": "",
    "content": ""
  }
]

// OR
{
  "name": "",
  "description": "",
  "content": ""
}
```

### Requesting Context Providers

Not seeing what you want? Create an issue [here](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) to request a new Context Provider.
