---
title: Build your own context provider
---

## Introductory Example

To write your own context provider, you just have to implement the `CustomContextProvider`
interface:

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

## Custom Context Providers with Submenu or Query

There are 3 types of context providers: "normal", "query", and "submenu". The "normal" type is the default, and is what we've seen so far.

The **"query"** type is used when you want to display a text box to the user, and then use the contents of that text box to generate the context items. Built-in examples include "search" and "google". This text is what gets passed to the "query" argument in `getContextItems`. To implement a "query" context provider, simply set `"type": "query"` in your custom context provider object.

The **"submenu"** type is used when you want to display a list of searchable items in the dropdown. Built-in examples include "issue" and "folder". To implement a "submenu" context provider, set `"type": "submenu"` and implement the `loadSubmenuItems` and `getContextItems` functions. Here is an example that shows a list of all README files in the current workspace:

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
    const { ide } = args;

    // Filter all workspace files for READMEs
    const workspaceDirs = await ide.getWorkspaceDirs()

    const allFiles = await Promise.all(
      workspaceDirs.map(dir => ide.subprocess(`find ${dir} -name "README.md"`)),
    );

    // 'readmes' now contains an array of file paths for each README.md file found in the workspace,
    // excluding those in 'node_modules'
    const readmes = allFiles
      .flatMap(mds => mds[0].split("\n"))
      .filter(file => file.trim() !== '' && !file.includes("/node_modules/"))

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

## Importing outside modules

To include outside Node modules in your config.ts, run `npm install <module_name>` from the `~/.continue` directory, and then import them in config.ts.

Continue will use [esbuild](https://esbuild.github.io/) to bundle your `config.ts` and any dependencies into a single Javascript file. The exact configuration used can be found [here](https://github.com/continuedev/continue/blob/5c9874400e223bbc9786a8823614a2e501fbdaf7/extensions/vscode/src/ideProtocol.ts#L45-L52).

## `CustomContextProvider` Reference

- `title`: An identifier for the context provider
- `displayTitle` (optional): The title displayed in the dropdown
- `description` (optional): The longer description displayed in the dropdown when hovered
- `type` (optional): The type of context provider. Options are "normal", "query", and "submenu". Defaults to "normal".
- `renderInlineAs` (optional): The string that will be rendered inline at the top of the prompt. If no value is provided, the `displayTitle` will be used. An empty string can be provided to prevent rendering the default `displayTitle`.
- `getContextItems`: A function that returns the documents to include in the prompt. It should return a list of `ContextItem`s, and is given access to the following arguments:
  - `extras.fullInput`: A string representing the user's full input to the text box. This can be used for example to generate an embedding to compare against a set of other embedded documents
  - `extras.embeddingsProvider`: The embeddings provider has an `embed` function that will convert text (such as `fullInput`) to an embedding
  - `extras.llm`: The current default LLM, which you can use to make completion requests
  - `extras.ide`: An instance of the `IDE` class, which lets you gather various sources of information from the IDE, including the contents of the terminal, the list of open files, or any warnings in the currently open file.
  - `query`: (not currently used) A string representing the query
- `loadSubmenuItems` (optional): A function that returns a list of `ContextSubmenuItem`s to display in a submenu. It is given access to an `IDE`, the same that is passed to `getContextItems`.

## Writing Context Providers in Other Languages

If you'd like to write a context provider in a language other than TypeScript, you can use the "http" context provider to call a server that hosts your own code. Add the context provider to `config.json` like this:

```json
{
  "name": "http",
  "params": {
    "url": "https://myserver.com/context-provider",
    "title": "http",
    "description": "Custom HTTP Context Provider",
    "displayTitle": "My Custom Context",
    "options": {}
  }
}
```

Then, create a server that responds to requests as are made from [HttpContextProvider.ts](../../../../core/context/providers/HttpContextProvider.ts). See the `hello` endpoint in [context_provider_server.py](../../../../core/context/providers/context_provider_server.py) for an example that uses FastAPI.

The `"options"` property can be used to send additional parameters to your endpoint, which will be included in the request body.

## Extension API for VSCode

Continue exposes an API for registering context providers from a 3rd party VSCode extension. This is useful if you have a VSCode extension that provides some additional context that you would like to use in Continue. To use this API, add the following to your `package.json`:

```json
{
  "extensionDependencies": ["continue.continue"]
}
```

Or copy `~/.continue/type/core/index.d.ts` to your extension repository.

Then, you can use the `registerCustomContextProvider` function to register your context provider. Your custom context provider must implement the `IContextProvider` interface.
Here is an example:

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
