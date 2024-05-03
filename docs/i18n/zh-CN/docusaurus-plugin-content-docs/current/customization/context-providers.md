---
title: 上下文提供者
description: 输入 '@' 来选择内容给 LLM 作为上下文
keywords: [上下文, "@", 提供者, LLM]
---

# 上下文提供者

上下文提供者允许你输入 '@' 看到一个内容下拉框，这些全部可以输入给 LLM 作为上下文。每个上下文提供者都是一个插件，也就是说如果你想要引用一些不在这里的信息来源，你可以请求（或者构建！）一个新的上下文提供者。

举个例子，比如你正在解决一个 Github Issue 。你输入 '@issue' 并选择一个你在工作的 Issue 。 Continue 可以看到 issue 的标题和内容。你也知道那个 issue 与文件 'readme.md' 和 'helloNested.py' 相关，所以你输入 '@readme' 和 '@hello' 来寻找和选择它们。现在这 3 个 "上下文条目" 会显示在你其余输入的行内。

![上下文条目](/img/context-provider-example.png)

## 内置上下文提供者

为了使用任何内置的上下文提供者，打开 `~/.continue/config.json` 并将它添加到 `contextProviders` 列表中。

### Code

输入 '@code' 来引用项目中指定的函数或类。

```json
{ "name": "code" }
```

### Git Diff

输入 '@diff' 来引用你对当前分支所做的所有修改。这是有用的，如果你想总结你所做的，或者在提交之前询问一个你的工作的通用的检查。

```json
{ "name": "diff" }
```

### 终端

输入 '@terminal' 来引用你的 IDE 终端的内容。

```json
{ "name": "terminal" }
```

### 文档

输入 `@docs` 从任何文档站点索引或获取片段。你可以通过选择 "Add Docs" 下拉框添加任何站点，然后输入文档的根 URL 和标题来记住它。在站点索引之后，你可以输入 `@docs` ，从下拉框选择你的文档， Continue 将在回答你的问题时，使用相似搜索来自动查找重要的章节。

```json
{ "name": "docs" }
```

### 打开文件

输入 '@open' 来引用所有你打开的文件的内容。设置 `onlyPinned` 为 `true` 只引用固定的文件。

```json
{ "name": "open", "params": { "onlyPinned": true } }
```

### 代码库检索

输入 '@codebase' 来从你的代码库自动检索最相关的片段。查看更多关于索引和检索 [这里](../walkthroughs/codebase-embeddings.md) 。

```json
{ "name": "codebase" }
```

### 文件夹

输入 '@folder' 来使用与 '@codebase' 相同的检索机制, 但是只有一个文件夹。

```json
{ "name": "folder" }
```

### 精准搜索

输入 '@search' 来引用代码库搜索的结果，就像你从 VS Code 搜索得到的结果。这个上下文提供者由 [ripgrep](https://github.com/BurntSushi/ripgrep) 驱动。

```json
{ "name": "search" }
```

### 文件树

输入 '@tree' 来引用当前工作区的结构。 LLM 将会看到你的项目的嵌套目录结构。

```json
{ "name": "tree" }
```

### Google

输入 '@google' 来引用 Google 搜索的结果。例如，输入 "@google python tutorial" ，如果你想要搜索讨论学习 Python 的方法。

```json
{
  "name": "google",
  "params": { "serperApiKey": "<your serper.dev api key>" }
}
```

注意：你可以从 [serper.dev](https://serper.dev) 免费获得 API key 。

### GitHub Issues

输入 '@issue' 来引用 Github issue 的讨论。确保包含你自己的 [GitHub personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) 来避免流量限制：

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

### GitLab 合并请求

输入 `@gitlab-mr` 来引用一个 Gitlab 上这个分支打开的 MR 。

#### 配置

你需要创建一个具有 `read_api` 范围的 [personal access token](https://docs.gitlab.com/ee/user/profile/personal_acess_tokens.html) 。然后把下面这个加到配置中。

```json
{
  "name": "gitlab-mr",
  "params": {
    "token": "..."
  }
}
```

#### 使用自托管的 GitLab

你可以指定访问的域名，通过在配置中设置 `domain` 参数。默认情况下是 `gitlab.com` 。

```json
{
  "name": "gitlab-mr",
  "params": {
    "token": "...",
    "domain": "gitlab.example.com"
  }
}
```

#### 过滤注释

如果你选择部分代码进行编辑，你可以有上下文提供者滤除其他文件的注释。要启用这个特性，设置 `filterComments` 为 `true` 。

### Jira Issues

输入 '@jira' 来引用 Jira issue 的讨论。确保使用你自己的 [Atlassian API Token](https://id.atlassian.com/manage-profile/security/api-tokens) 。

```json
{
  "name": "jira",
  "params": {
    "domain": "company.atlassian.net",
    "email": "someone@somewhere.com",
    "token ": "ATATT..."
  }
}
```

#### Jira Datacenter 支持

这个上下文提供者支持 Jira API 版本 2 和 3 。它默认会使用版本 3 ，因为这是云上版本使用的，但是如果你有 Jira 的 datacenter 版本，你需要设置 API 版本为 2 ，使用  `apiVersion` 属性。

```json
  "params": {
    "apiVersion": "2",
    ...
  }
```

#### Issue 查询

默认情况下，使用下面的查询来查找 issue ：

```jql
assignee = currentUser() AND resolution = Unresolved order by updated DESC
```

你可以通过设置 `issueQuery` 参数来覆盖这个查询。

### 代码大纲

输入 '@outline' 来引用所有当前打开文件的大纲。文件大纲只包含文件的函数和类的定义。支持的文件扩展名是 '.js', '.mjs', '.go', '.c', '.cc', '.cs', '.cpp', '.el', '.ex', '.elm', '.java', '.ml', '.php', '.ql', '.rb', '.rs', '.ts'

```json
{ "name": "outline" }
```

### 代码高亮

输入 '@highlights' 来引用所有打开文件中的高亮部分。高亮是由在 [Aider Chat](https://github.com/paul-gauthier/aider) 的 Paul Gauthier's 的 ['repomap'](https://aider.chat/docs/repomap.html) 技术来计算的。支持的文件扩展名与 '@outline' 相同 (在幕后，我们使用相关的 tree-sitter 语法器来解析语言) 。

```json
{ "name": "highlights" }
```

### PostgreSQL

输入 `@postgres` 来引用表的 schema ，和一些示例行。一个下拉框会出现，允许你选择指定的表或所有表。

只需要创建数据库连接的配置： `host`, `port`, `user`, `password` 和 `database` 。

默认情况下， `schema` 过滤器设置为 `public` ， `sampleRows` 设置为 3 。如果你希望包含所有 schema 的表，你可以取消设置 schema 。

[这是一个简单的 demo](https://github.com/continuedev/continue/pull/859) 。

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

### 数据库表

输入 `@database` 来引用表 schema ，你可以基于你的配置使用下拉或者输入表名。配置支持多个数据库，允许你为 PostgresSQL MySQL SQLite 指定不同的连接详情。每个连接都应该有唯一的名字，连接类型（比如， postgres, sqlite ），以及每个数据库类型必须的连接参数。

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

### 调试器：本地变量

输入 `@locals` 来引用本地变量的内容，关于那个线程最高 n 层（默认 3 层）的调用 stack 。一个下拉框会出现，允许你选择一个指定的线程来查看那个线程的本地变量。

```json
{
  "name": "locals",
  "params": {
    "stackDepth": 3
  }
}
```

### 请求上下文提供者

没有看到你想要的？创建一个 issue [这里](https://github.com/continuedev/continue/issues/new?assignees=TyDunn&labels=enhancement&projects=&template=feature-request-%F0%9F%92%AA.md&title=) 来请求一个新的 ContextProvider 。

## 构建你自己的上下文提供者

> 目前自定义上下文提供者只支持在 VS Code 中，但是很快会出现在 JetBrains IDE 中。

### 入门示例

为了编写你自己的上下文提供者，你只需要实现 `CustomContextProvider` 接口：

```typescript
interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;
}
```

作为一个例子，假设你有一系列的内部文件，已经被索引到向量数据库中。你已经配置了一个简单的 REST API ，允许内部用户查询，获取相关的片段。这个上下文提供者将发送查询到这个服务器中，从向量数据库中返回结果。返回的 `getContextItems` 类型 _必须_ 是一个对象列表，包含所有下列属性：

- `name`: 上下文条目的名称，将显示为标题
- `description`: 上下文条目的一个较长的描述
- `content`: 上下文条目的实际内容，将发送给 LLM 作为上下文

```typescript title="~/.continue/config.ts"
const RagContextProvider: CustomContextProvider = {
  title: "rag",
  displayTitle: "RAG",
  description:
    "Retrieve snippets from our vector database of internal documents",

  getContextItems: async (
    query: string,
    extras: ContextProviderExtras,
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

它可以被添加到 `config.ts` 中，像这样：

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  if (!config.contextProviders) {
    config.contextProviders = [];
  }
  config.contextProviders.push(RagContextProvider);
  return config;
}
```

不需要对 `config.json` 修改。

### 自定义含有子菜单或查询的上下文提供者

有 3 种类型的上下文提供者： "normal", "query" 和 "submenu" 。 "normal" 类型是默认的，是到目前为止我们看到的。

**"query"** 类型使用在当你想要展示一个文本框给用户，然后使用那个文本框中的内容来生成上下文条目。内置的例子包括 ["search"](#exact-search) 和 ["google"](#google) 。这个文本发送给 `getContextItems` 的 "query" 参数。为了实现一个 "query" 上下文提供者，简单地在你的自定义上下文提供者对象中设置 `"type": "query"` 。

**"submenu"** 类型使用在当你想要在下拉框中展示一个可搜索的列表。内置的例子包括 ["issue"](#github-issues) 和 ["folder"](#folders) 。为了实现一个 "submenu" 上下文提供者，设置 `"type": "submenu"` 并实现 `loadSubmenuItems` 和 `getContextItems` 函数。这是一个例子，展示一个当前工作区所有 README 文件的列表。

```typescript title="~/.continue/config.ts"
const ReadMeContextProvider: CustomContextProvider = {
  title: "readme",
  displayTitle: "README",
  description: "Reference README.md files in your workspace",
  type: "submenu",

  getContextItems: async (
    query: string,
    extras: ContextProviderExtras,
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
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> => {
    // Filter all workspace files for READMEs
    const allFiles = await args.ide.listWorkspaceContents();
    const readmes = allFiles.filter((filepath) =>
      filepath.endsWith("README.md"),
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

上面例子中的信息流如下：

1. 用户输入 `@readme` 并从下拉框中选择它，现在显示子菜单，他们可以搜索 `loadSubmenuItems` 返回的任何条目。
2. 用户选择子菜单中的一个 README ，输入其他的输入，按下回车。
3. 被选择的 `ContextSubmenuItem` 的 `id` 被发送给 `getContextItems` 作为 `query` 参数。在这个情况下，它是 README 的文件路径。
4. 然后 `getContextItems` 函数可以使用 `query` ，来获取 README 的全部内容，在返回上下文条目之前，对内容进行格式化，它将被包含在提示词中。

### 导入外部模块

为了包含外部的 Node 模块到你的 `config.ts` 中，在 `~/.continue` 目录中运行 `npm install <module_name>` ，然后在 `config.ts` 中导入它们：

Continue 将使用 [esbuild](https://esbuild.github.io/) 来打包你的 `config.ts` 和任何依赖到一个单独的 Javascript 文件中。使用的配置可以 [这里](https://github.com/continuedev/continue/blob/5c9874400e223bbc9786a8823614a2e501fbdaf7/extensions/vscode/src/ideProtocol.ts#L45-L52) 找到。

### `CustomContextProvider` 参考

- `title`: 上下文提供者的标识符
- `displayTitle` (可选): 在下拉框中显示的标题
- `description` (可选): 当鼠标悬停时，在下拉框中显示的较长的描述
- `type` (可选): 上下文提供者的类型。可选项是 "normal", "query", 和 "submenu" 。默认是 "normal"
- `getContextItems`: 一个函数，返回包含在提示词中的文档。它应该返回一个 `ContextItem` 列表，可以访问下列参数：
  - `extras.fullInput`: 一个字符串，表示用户在文本框的全部输入。这是可以用来比如生成一个嵌入，来与一系列其他的嵌入文档进行比较
  - `extras.embeddingsProvider`: 嵌入提供者有一个 `embed` 函数，将文本（比如 `全部输入`）转换为嵌入
  - `extras.llm`: 目前默认的 LLM ，可以用来生成补全请求
  - `extras.ide`: 一个 `IDE` 类的实例，允许你收集 IDE 不同来源的信息，包含终端的内容，打开文件的列表，或者当前打开文件的任何警告
  - `query`: (不是当前使用的) 一个字符串，表示查询
- `loadSubmenuItems` (可选): 一个函数，返回一个 `ContextSubmenuItem` 列表，显示在子菜单中。它可以访问 `IDE` ，与传递给 `getContextItems` 的类似
