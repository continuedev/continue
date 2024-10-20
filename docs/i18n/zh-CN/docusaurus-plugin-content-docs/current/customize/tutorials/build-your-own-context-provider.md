---
title: 构建你自己的上下文提供者
---

## 入门示例

要编写你自己的上下文提供者，你只需要实现 `CustomContextProvider` 接口：

```typescript
interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  renderInlineAs?: string;
  type?: ContextProviderType;
  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;
  loadSubmenuItems?: (
    args: LoadSubmenuItemsArgs,
  ) => Promise<ContextSubmenuItem[]>;
}
```

作为一个例子，比如你有一系列内部文件索引到一个向量数据库中。你设置了一个简单的 REST API ，允许内部用户查询和获取相关的片段。这个上下文提供者将会发送请求到这个服务器，并从向量数据库返回结果。返回的类型 `getContextItems` _必须_ 是一个包含所有以下属性的实例的列表：

- `name`: 上下文条目的名称，将会展示为标题
- `description`: 上下文条目的一个较长的描述
- `content`: 上下文条目的实际内容，将会发送给 LLM 作为上下文

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

它可以被添加到 `config.ts` 像这样：

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  if (!config.contextProviders) {
    config.contextProviders = [];
  }
  config.contextProviders.push(RagContextProvider);
  return config;
}
```

不需要对  `config.json` 做修改。

## 定制有 submenu 或 query 的上下文提供者

这里有 3 种类型的上下文提供者："normal", "query" 和 "submenu" 。 "normal" 类型是默认的，就是你目前所看到的。

**"query"** 类型用来当你想要显示文本框给用户，然后使用那个文本框的内容生成上下文条目。内置示例包含 "search" 和 "google" 。这个文本是传递给 `getContextItems` 中的 "query" 参数。为了实现一个 "query" 上下文提供者，简单地设置 `"type": "query"` 在你的定制上下文提供者实例中。

**"submenu"** 类型用来当你想要在下拉框显示一个可搜索条目列表。内置示例包含 "issue" 和 "folder" 。为了实现一个 "submenu" 上下文提供者，设置 `"type": "submenu"` 并实现 `loadSubmenuItems` 和 `getContextItems` 函数。这是一个例子，显示当前工作区所有 README 文件的列表：

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

以上示例的信息流如下：

1. 用户输入 `@readme` 并从下拉框中选择，现在显示子菜单，他们可以搜索任何 `loadSubmenuItems` 返回的条目。
2. 用户在子菜单中选择 README 之一，输入其他输入，并按下回车。
3. 选择的 `ContextSubmenuItem` 的 id 传递给 `getContextItems` 作为 `query` 参数。在这个例子中，它是 README 的文件路径。
4. 然后 `getContextItems` 函数使用 `query` 获取 README 的完整内容，并在返回上下文条目之前格式化内容，它会包含在提示词之中。

## 导入外部模块

为了包含外部的 Node 模块在你的 config.ts 中，在 `~/.continue` 文件夹运行 `npm install <module_name>` ，然后在 config.ts 中导入它们。

Continue 将使用 [esbuild](https://esbuild.github.io/) 打包你的 `config.ts` 和任何依赖到一个单独的 Javascript 文件。确切使用的配置可以在 [这里](https://github.com/continuedev/continue/blob/5c9874400e223bbc9786a8823614a2e501fbdaf7/extensions/vscode/src/ideProtocol.ts#L45-L52) 找到。

## `CustomContextProvider` 参考

- `title`: 上下文提供者的标识符
- `displayTitle` （可选）：在下拉框中显示的标题
- `description` （可选）：当鼠标悬停时，在下拉框中显示的较长的描述
- `type` （可选）：上下文提供者的类型。可选项是 "normal", "query" 和 "submenu" 。默认是 "normal" 。
- `renderInlineAs` （可选）：将会在提示词上面渲染的字符串。如果没有值提供， `displayTitle` 将会被sisyphus。可以提供空字符串来禁止渲染默认的 `displayTitle` 。
- `getContextItems`: A function that returns the documents to include in the prompt. It should return a list of `ContextItem`s, and is given access to the following arguments:
- `getContextItems`: 一个返回包含在提示词中文档的函数。它应该返回一个 `ContextItem` 列表，并可以访问以下参数：
  - `extras.fullInput`: 一个代表用户在文本框中完整输入的字符串。这可以用来生成嵌入，与一批其他的嵌入文档比较
  - `extras.embeddingsProvider`: 嵌入提供者有一个 `embed` 函数，将会转换文本 (例如 `fullInput`) 为嵌入
  - `extras.llm`: 当前默认的 LLM ，你可以用来创建补全请求
  - `extras.ide`: 一个 `IDE` 类的实例，让你可以收集来自 IDE 的不同来源的信息，包括终端的内容，打开文件的列表，或追额当前打开文件中的任何警告。
  - `query`: (not currently used) A string representing the query
  - `query`: （当前没有使用） 代表 query 的字符串
- `loadSubmenuItems` （可选）： 一个返回 `ContextSubmenuItem` 列表的函数，显示在子菜单中。它可以访问 `IDE` ，同样传递给 `getContextItems` 。

## 使用其他语言编写上下文提供者

如果你想要用除了 TypeScript 的其他语言编写上下文提供者，你可以使用 "http" 上下文提供者，来调用一个托管你自己代码的服务器。添加上下文提供者到 `config.json` ，像这样：

```json
{
  "name": "http",
  "params": {
    "url": "https://myserver.com/context-provider",
    "title": "http",
    "description": "Custom HTTP Context Provider",
    "displayTitle": "My Custom Context"
  }
}
```

<!-- Then, create a server that responds to requests as are made from [HttpContextProvider.ts](../../../core/context/providers/HttpContextProvider.ts). See the `hello` endpoint in [context_provider_server.py](../../../core/context/providers/context_provider_server.py) for an example that uses FastAPI. -->

## VSCode 的扩展 API

Continue 暴露一个 API ，从第三方 VSCode 扩展注册上下文提供者。这是有用的，如果你有一个 VSCode 扩展，提供一些额外的上下文，你想要在 Continue 中使用。为了使用这个 API ，添加以下内容到你的 `package.json` ：

```json
{
  "extensionDependencies": ["continue.continue"]
}
```

或者复制 `~/.continue/type/core/index.d.ts` 到你的扩展仓库。

然后，你可以使用 `registerCustomContextProvider` 函数注册你的上下文提供者。你定制的上下文提供者必须实现 `IContextProvider` 接口。
这是一个例子：

```typescript
import * as vscode from "vscode";

class MyCustomProvider implements IContextProvider {
  get description(): ContextProviderDescription {
    return {
      title: "custom",
      displayTitle: "Custom",
      description: "Custom description",
      type: "normal",
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return [
      {
        name: "Custom",
        description: "Custom description",
        content: "Custom content",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    return [];
  }
}

// create an instance of your custom provider
const customProvider = new MyCustomProvider();

// get Continue extension using vscode API
const continueExt = vscode.extensions.getExtension("continue.continue");

// get the API from the extension
const continueApi = continueExt?.exports;

// register your custom provider
continueApi?.registerCustomContextProvider(customProvider);
```
