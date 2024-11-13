---
title: 上下文提供者
description: 输入 '@' 选择内容到 LLM 作为上下文
keywords: [上下文, "@", 提供者, LLM]
---

上下文提供者允许你输入 '@' ，看到一个上下文下拉框，都可以提供给 LLM 作为上下文。每个上下文提供者是一个插件，也就是说，如果你想要关联一些没有在这里看到的信息源，你可以请求（或构建！）一个新的上下文提供者。

举一个例子，比如你工作在解决一个新的 GitHub Issue 。你输入 '@Issue' 并选择你工作的那个。 Continue 现在可以看到 issue 标题和内容。你还知道那个 issue 关联到文件 'readme.md' 和 'helloNested.py' ，所以你输入 '@readme' 和 '@hello' 查看并选择它们。现在，这里有 3 个 "上下文条目" 在行内显示，和你的其他输入一起。

![上下文条目](/img/context-provider-example.png)

## 内置的上下文提供者

为了使用任何内置的上下文提供者，打开 `config.json` 并将它添加到 `contextProviders` 列表中。

### `@File`

关联你的当前工作区的任何文件。

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

关联你的项目中特定的函数或类。

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

关联你对当前分支所在的所有修改。这是有用的，如果你想要在提交之前，总结你做了什么，或询问一个关于你的工作通用的评审。

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

关联你的 IDE 终端的内容。

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

关联任何文档网站的内容。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs"
    }
  ]
}
```

注意这只启用 `@Docs` 上下文提供者。

为了使用它，你需要添加一个文档网站到你的 `config.json` 。查看 [docs](../customize/deep-dives/docs.md) 页面获取更多信息。

### `@Open`

关联你打开的所有文件的内容。设置 `onlyPinned` 为 `true` 只关联固定的文件。

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

### `@Codebase`

关联你的代码库中最相关的片段。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "codebase"
    }
  ]
}
```

在 [这里](../customize/deep-dives/codebase.md) 查看更多关于索引和检索。

### `@Folder`

使用和 `@Codebase` 相同的检索机制，但是只在一个单独的文件夹上。

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

关联代码库搜索的结果，就像你从 VS Code 搜索获得的结果。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "search"
    }
  ]
}
```

这个上下文提供者是由 [ripgrep](https://github.com/BurntSushi/ripgrep) 支持的。

### `@Url`

关联给定 URL 的 markdown 转换内容。

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

关联你当前工作区的结构。

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

关联 Google 搜索的结果。

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

例如，输入 "@Google python tutorial" ，如果你想要搜索或讨论学习 Python 的方法。

注意：你可以在 [serper.dev](https://serper.dev) 免费获得 API key 。

### `@Issue`

关联一个 GitHub issue 的交谈信息。

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

确保包含你自己的 [GitHub 个人访问 token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) 来避免频率限制。

### `@Gitlab Merge Request`

关联一个 Gitlab 上这个分支上打开的 MR 。

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

你需要创建一个使用 `read_api` 范围的 [个人访问 token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html)。

#### 使用自托管的 GitLab

你可以指定要访问的域名，通过在你的配置中设置 `domain` 参数。默认情况下是 `gitlab.com` 。

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

#### 过滤评论

如果你选择一些代码被编辑，你可以有上下文提供者过滤其他文件的评论。要启用这个特性，设置 `filterComments` 为 `true` 。

### `@Jira`

关联一个 Jira issue 的交谈信息。

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

确认包含你自己的 [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens) ，或者使用你的 `email` 和 `token` ， token 设置为你的密码获得基本认证。如果你使用自己的 Atlassian API Token ，不要配置你的邮箱。

#### Jira Datacenter 支持

这个上下文提供者支持 Jira API 版本 2 和 3 。默认情况下，它将使用版本 3 ，因为这是云版本使用的，但是如果你有 datacenter 版本的 Jira ，你需要使用 `apiVersion` 属性设置 API Version 为 2 。

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

#### Issue 查询

默认情况下，以下查询用来查找 issue ：

```jql
assignee = currentUser() AND resolution = Unresolved order by updated DESC
```

你可以覆盖这个查询，通过设置 `issueQuery` 参数。

### `@Postgres`

关联表的 schema ，和一些示例行

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

仅需要的配置是那些创建数据库连接所需要的： `host`, `port`, `user`, `password` 和 `database` 。

默认情况下， `schema` 过滤器设置为 `public` ， `sampleRows` 设置为 3 。你可以取消设置 schema ，如果你想要包含所有 schema 的表。

[这是一个简单的 demo](https://github.com/continuedev/continue/pull/859) 。

### `@Database`

关联 Sqlite, Postgres 和 MySQL 数据库的表 schema 。

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

每个连接应该有一个单独的名称，`connection_type` ，以及每个数据库类型特定的必须的连接参数。

可用的连接类型：

- `postgres`
- `mysql`
- `sqlite`

### `@Locals`

关联调试器中本地变量的内容。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "locals",
      "params": {
        "stackDepth": 3
      }
    }
  ]
}
```

使用最多 _n_ 级 (默认是 3) 的当前线程的调用栈。

### `@Repository Map`

关联你的代码库的概览。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "repo-map"
    }
  ]
}
```

提供一个文件列表，以及这些文件中的最高级的类、函数和方法的调用签名。这帮助模型更好地理解，一段特定的代码如何关联其他的代码库。

在出现的子菜单中，你可以选择 `Entire codebase` 或指定一个子文件夹，来生成仓库映射。

这个上下文提供者想法来自 [Aider's repository map](https://aider.chat/2023/10/22/repomap.html) 。

### `@Operating System`

关联你当前操作系统的架构和平台。

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

HttpContextProvider 创建一个 POST 请求到配置中的 url 。服务器必须返回 200 OK ，以及一个 ContextItem 对象或一个 ContextItems 列表。

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "http",
      "params": {
        "url": "https://api.example.com/v1/users",
      }
    }
  ]
}
```

接收的 URL 应该接收下面的参数：
```json title="POST parameters"
{
  query: string,
  fullInput: string
}
```

响应 200 OK 应该是一个有以下结构的 JSON 对象：
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

### 请求上下文提供者

没有看到你想要的？[在这里](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) 创建一个 issue 来请求一个新的上下文提供者。
