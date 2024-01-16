# Contributing to Continue

## Table of Contents

- [❤️ Ways to Contribute](#️-ways-to-contribute)
  - [👋 Continue Contribution Ideas](#-continue-contribution-ideas)
  - [🐛 Report Bugs](#-report-bugs)
  - [✨ Suggest Enhancements](#-suggest-enhancements)
  - [📖 Updating / Improving Documentation](#-updating--improving-documentation)
  - [🧑‍💻 Contributing Code](#-contributing-code)
    - [Environment Setup](#environment-setup)
    - [Writing Slash Commands](#writing-slash-commands)
    - [Writing Context Providers](#writing-context-providers)
    - [Adding Models](#adding-models)
- [📐 Continue Architecture](#-continue-architecture)
  - [Continue VS Code Extension](#continue-vs-code-extension)
  - [Continue JetBrains Extension](#continue-jetbrains-extension)

# ❤️ Ways to Contribute

## 👋 Continue Contribution Ideas

[This GitHub project board](https://github.com/orgs/continuedev/projects/2) is a list of ideas for how you can contribute to Continue. These aren't the only ways, but are a great starting point if you are new to the project.

## 🐛 Report Bugs

If you find a bug, please [create an issue](https://github.com/continuedev/continue/issues) to report it! A great bug report includes:

- A description of the bug
- Steps to reproduce
- What you expected to happen
- What actually happened
- Screenshots or videos

## ✨ Suggest Enhancements

Continue is quickly adding features, and we'd love to hear which are the most important to you. The best ways to suggest an enhancement are

- Create an issue

  - First, check whether a similar proposal has already been made
  - If not, [create an issue](https://github.com/continuedev/continue/issues)
  - Please describe the enhancement in as much detail as you can, and why it would be useful

- Join the [Continue Discord](https://discord.gg/NWtdYexhMs) and tell us about your idea in the `#feedback` channel

## 📖 Updating / Improving Documentation

Continue is continuously improving, but a feature isn't complete until it is reflected in the documentation! If you see something out-of-date or missing, you can help by clicking "Edit this page" at the bottom of any page on [continue.dev/docs](https://continue.dev/docs).

## 🧑‍💻 Contributing Code

> Please make PRs to the `preview` branch. We use this to first test changes in a pre-release version of the extension.

### Environment Setup

VS Code is assumed for development as Continue is primarily a VS Code tool at the moment. Most of the setup and running is automated through VS Code tasks and launch configurations.

Pre-requisite: you will need `cargo` the rust package manager installed ([get it on rust-lang.org](https://www.rust-lang.org/tools/install)).

1. Clone and open in VS Code the Continue repo `https://github.com/continuedev/continue`

2. Open VS Code command pallet (`cmd+shift+p`) and select `Tasks: Run Task` and then select `install-all-dependencies`

3. Start debugging:

   1. Switch to Run and Debug view
   2. Select `Extension (VS Code)` from drop down
   3. Hit play button
   4. This will start the extension in debug mode and open a new VS Code window with it installed
      1. I call the VS Code window with the extension the _Host VS Code_
      2. The window you started debugging from is referred to as the _Main VS Code_

4. Try using breakpoints:
   > Note: Breakpoints for the code inside of the `gui` folder are not currently supported while debugging the entire extension, but can be used with the "Vite" launch configuration and Google Chrome.
   1. _In Main VS Code_: Search for `function addHighlightedCodeToContext` and set a breakpoint at the top of the function. This is the method invoked whenever code in the editor is selected to be used as context.
   2. _In Host VS Code_: Select part of the `example.ts` file and use the keyboard shortcut cmd/ctrl+m to select the code and notice that your breakpoint should be hit.

### Formatting

Continue uses [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) to format JavaScript/TypeScript. Please install these extensions in VS Code and enable "Format on Save" in your settings.

### Writing Slash Commands

A Step can be used as a custom slash command, or called otherwise in a `Policy`. See the [steps README](./server/continuedev/plugins/steps/README.md) to learn how to write a Step.

### Writing Context Providers

A `ContextProvider` is a Continue plugin that lets type '@' to quickly select documents as context for the language model. The simplest way to create a `ContextProvider` is to implement the `provide_context_items` method. You can find a great example of this in [GitHubIssuesContextProvider](./server/continuedev/plugins/context_providers/github.py), which allows you to search GitHub Issues in a repo.

### Adding Models

While any model that works with a supported provider can be used with Continue, we keep a list of recommended models that can be automatically configured from the UI or `config.json`. The following files should be updated when adding a model:

- [config_schema.json](./extensions/vscode/config_schema.json) - This is the JSON Schema definition that is used to validate `config.json`. You'll notice a number of rules defined in "definitions.ModelDescription.allOf". Here is where you write rules that can specify something like "for the provider 'anthropic', only models 'claude-2' and 'claude-instant-1' are allowed. Look through all of these rules and make sure that your model is included for providers that support it.
- [modelData.ts](./gui/src/util/modelData.ts) - This file defines that information that is shown in the model selection UI in the side bar. To add a new model:
  1. create a `ModelPackage` object, following the lead of the many examples near the top of the file
  2. add the `ModelPackage` to the `MODEL_INFO` array if you would like it to be displayed in the "Models" tab
  3. if you would like it to be displayed as an option under any of the providers, go to the `PROVIDER_INFO` object and add it to the `packages` array for each provider that you want it to be displayed under. If it is an OS model that should be valid for most providers offering OS models, you might just be able to add it to the `osModels` array as shorthand.
- [index.d.ts](./core/index.d.ts) - This file defines the TypeScript types used throughout Continue. You'll find a `ModelName` type. Be sure to add the name of your model to this.
- LLM Providers: Since many providers use their own custom strings to identify models, you'll have to add the translation from Continue's model name (the one you added to `index.d.ts`) and the model string for each of these providers: [Ollama](./core/llm/llms/Ollama.ts), [Together](./core/llm/llms/Together.ts), and [Replicate](./core/llm/llms/Replicate.ts). You can find their full model lists here: [Ollama](https://ollama.ai/library), [Together](https://docs.together.ai/docs/inference-models), [Replicate](https://replicate.com/collections/streaming-language-models).
- [Prompt Templates](./core/llm/index.ts) - In this file you'll find the `autodetectTemplateType` function. Make sure that for the model name you just added, this function returns the correct template type. This is assuming that the chat template for that model is already built in Continue. If not, you will have to add the template type and corresponding edit and chat templates.

## 📐 Continue Architecture

Continue consists of 2 parts that are split so that it can be extended to work in other IDEs as easily as possible:

1. **Continue GUI** - The Continue GUI is a React application that gives the user control over Continue. It displays the current chat history, allows the user to ask questions, invoke slash commands, and use context providers. The GUI also handles most state and holds as much of the logic as possible so that it can be reused between IDEs.

2. **Continue Extension** - The Continue Extension is a plugin for the IDE which implements the [IDE Interface](./core/index.d.ts#L229). This allows the GUI to request information from or actions to be taken within the IDE. This same interface is used regardless of IDE. The first Continue extensions we have built are for VS Code and JetBrains, but we plan to build clients for other IDEs in the future. The IDE Client must 1. implement IDE Interface, as is done [here](./extensions/vscode/src/ideProtocol.ts) for VS Code and 2. display the Continue GUI in a sidebar, like [here](./extensions/vscode/src/debugPanel.ts).

### Continue VS Code Extension

The starting point for the VS Code extension is [activate.ts](./extensions/vscode/src/activation/activate.ts). The `activateExtension` function here will register all commands and load the Continue GUI in the sidebar of the IDE as a webview.

### Continue JetBrains Extension

The JetBrains extension is currently in alpha testing. Please reach out on [Discord](https://discord.gg/vapESyrFmJ) if you are interested in contributing to its development.
