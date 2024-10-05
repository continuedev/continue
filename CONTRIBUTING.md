Note: This file has been modified from its original contents. pearai-submodule is a fork of Continue (https://github.com/continuedev/continue).

# 🍐 Contributing to PearAI

## 🌐 **For how to setup, build, and run PearAI, please visit [PearAI-App Contributing](https://github.com/trypear/pearai-app/blob/main/CONTRIBUTING.md) for the main guide!**

- [✨ Writing Slash Commands](#-writing-slash-commands)
- [📜 Writing Context Providers](#-writing-context-providers)
- [🤖 Adding an LLM Provider](#-adding-an-llm-provider)
- [🧠 Adding Models](#-adding-models)
- [📖 Adding Pre-indexed Documentation](#-adding-pre-indexed-documentation)
- [⚙️ PearAI Architecture](#-pearai-architecture)
 - [🧩 PearAI VS Code Extension](#-pearai-vs-code-extension)

### 📚 PearAI Submodule Specific Guides:

#### ✨ Writing Slash Commands

The slash command interface, defined in [core/index.d.ts](./core/index.d.ts), requires you to define:
- `name`: The text that will be typed to invoke the command.
- `description`: The text that will be shown in the slash command menu.
- `run`: An async generator function that will be called when the command is invoked. It yields the content to be displayed in the chat and is passed a `PearAISDK` object for interacting with the IDE, calling the LLM, and accessing chat history.
```ts
export interface SlashCommand {
  name: string;
  description: string;
  params?: { [key: string]: any };
  run: (sdk: PearAISDK) => AsyncGenerator<string | undefined>;
}
```
There are many examples of slash commands in [core/commands/slash](./core/commands/slash) that we recommend borrowing from. Once you've created your new `SlashCommand` in this folder, be sure to complete the following 🌟:

- ✅ Add your command to the array in [core/commands/slash/index.ts](./core/commands/slash/index.ts)
- 🔧 Add your command to the list in [`config_schema.json`](./extensions/vscode/config_schema.json). This ensures that Intellisense shows users what commands are available for your provider when they are editing `config.json`. If there are any parameters that your command accepts, you should also follow existing examples in adding them to the JSON Schema.

### 📜 Writing Context Providers

A `ContextProvider` is a PearAI plugin that lets you type '@' to quickly select documents as context for the language model. The `IContextProvider` interface is defined in [`core/index.d.ts`](./core/index.d.ts), but all built-in context providers extend [`BaseContextProvider`](./core/context/index.ts).

Before defining your context provider, determine which "type" you want to create. The `"query"` type will show a small text input when selected, giving the user a chance to enter something like a Google search query for the [`GoogleContextProvider`](./core/context/providers/GoogleContextProvider.ts). The `"submenu"` type will open up a submenu of items that can be searched through and selected. Examples are the [`GitHubIssuesContextProvider`](./core/context/providers/GitHubIssuesContextProvider.ts) and the [`DocsContextProvider`](./core/context/providers/DocsContextProvider.ts). The `"normal"` type will just immediately add the context item. Examples include the [`DiffContextProvider`](./core/context/providers/DiffContextProvider.ts) and the [`OpenFilesContextProvider`](./core/context/providers/OpenFilesContextProvider.ts).

After you've written your context provider, make sure to complete the following 🌟:

- ✅ Add it to the array of context providers in [core/context/providers/index.ts](./core/context/providers/index.ts)
- 🔧 Add it to the `ContextProviderName` type in [core/index.d.ts](./core/index.d.ts)
- 📄 Add it to the list in [`config_schema.json`](./extensions/vscode/config_schema.json). If there are any parameters that your context provider accepts, you should also follow existing examples in adding them to the JSON Schema.

### 🤖 Adding an LLM Provider

PearAI has support for more than a dozen different LLM "providers", making it easy to use models running on OpenAI, Ollama, Together, LM Studio, and more. You can find all of the existing providers [here](https://github.com/trypear/pearai-submodule/tree/main/core/llm/llms), and if you see one missing, you can add it with the following steps:

1. 🆕 Create a new file in the `core/llm/llms` directory. The name of the file should be the name of the provider, and it should export a class that extends `BaseLLM`. This class should contain the following minimal implementation. We recommend viewing pre-existing providers for more details. The [LlamaCpp Provider](./core/llm/llms/LlamaCpp.ts) is a good simple example.

- 📛 `providerName` - the identifier for your provider
- 📤 At least one of `_streamComplete` or `_streamChat` - This is the function that makes the request to the API and returns the streamed response. You only need to implement one because PearAI can automatically convert between "chat" and "raw completion".

2. ✅ Add your provider to the `LLMs` array in [core/llm/llms/index.ts](./core/llm/llms/index.ts).
3. 🖼️ If your provider supports images, add it to the `PROVIDER_SUPPORTS_IMAGES` array in [core/llm/index.ts](./core/llm/index.ts).
4. 🔧 Add the necessary JSON Schema types to [`config_schema.json`](./extensions/vscode/config_schema.json). This ensures that Intellisense shows users what options are available for your provider when they are editing `config.json`.
5. 📄 Add a documentation page for your provider in [`docs/docs/reference/Model Providers`](./docs/docs/reference/Model%20Providers). This should show an example of configuring your provider in `config.json` and explain what options are available.

### 🧠 Adding Models

While any model that works with a supported provider can be used with PearAI, we keep a list of recommended models that can be automatically configured from the UI or `config.json`. The following files should be updated when adding a model:

- 📂 [Prompt Templates](./core/llm/index.ts) - In this file you'll find the `autodetectTemplateType` function. Make sure that for the model name you just added, this function returns the correct template type. This is assuming that the chat template for that model is already built in PearAI. If not, you will have to add the template type and corresponding edit and chat templates.

### 📖 Adding Pre-indexed Documentation

PearAI's @docs context provider lets you easily reference entire documentation sites and then uses embeddings to add the most relevant pages to context. To make the experience as smooth as possible, we pre-index many of the most popular documentation sites. If you'd like to add new documentation to this list, just add an object to the list in [preIndexedDocs.ts](./core/indexing/docs/preIndexedDocs.ts). `startUrl` is where the crawler will start and `rootUrl` will filter out any pages not on that site and under the path of `rootUrl`.

## ⚙️ PearAI Architecture

PearAI consists of 2 parts that are split so that it can be extended to work in other IDEs as easily as possible:

1. **🖥️ PearAI GUI** - The PearAI GUI is a React application that gives the user control over PearAI. It displays the current chat history, allows the user to ask questions, invoke slash commands, and use context providers. The GUI also handles most state and holds as much of the logic as possible so that it can be reused between IDEs.

2. **🔌 PearAI Extension** - The PearAI Extension is a plugin for the IDE which implements the [IDE Interface](./core/index.d.ts#L229). This allows the GUI to request information from or actions to be taken within the IDE. This same interface is used regardless of IDE. The first PearAI extensions we have built are for VS Code and JetBrains, but we plan to build clients for other IDEs in the future. The IDE Client must 1. implement IDE Interface, as is done [here](./extensions/vscode/src/ideProtocol.ts) for VS Code and 2. display the PearAI GUI in a sidebar, like [here](./extensions/vscode/src/debugPanel.ts).

### 🧩 PearAI VS Code Extension

The starting point for the VS Code extension is [activate.ts](./extensions/vscode/src/activation/activate.ts). The `activateExtension` function here will register all commands and load the PearAI GUI in the sidebar of the IDE as a webview.