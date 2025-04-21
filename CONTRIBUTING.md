# Contributing to Continue

## Table of Contents

- [Contributing to Continue](#contributing-to-continue)
  - [Table of Contents](#table-of-contents)
- [❤️ Ways to Contribute](#️-ways-to-contribute)
  - [👋 Continue Contribution Ideas](#-continue-contribution-ideas)
  - [🐛 Report Bugs](#-report-bugs)
  - [✨ Suggest Enhancements](#-suggest-enhancements)
  - [📖 Updating / Improving Documentation](#-updating--improving-documentation)
    - [Running the Documentation Server Locally](#running-the-documentation-server-locally)
      - [Method 1: NPM Script](#method-1-npm-script)
      - [Method 2: VS Code Task](#method-2-vs-code-task)
  - [🧑‍💻 Contributing Code](#-contributing-code)
    - [Environment Setup](#environment-setup)
      - [Pre-requisites](#pre-requisites)
      - [Fork the Continue Repository](#fork-the-continue-repository)
      - [VS Code](#vs-code)
        - [Debugging](#debugging)
      - [JetBrains](#jetbrains)
    - [Our Git Workflow](#our-git-workflow)
    - [Development workflow](#development-workflow)
    - [Formatting](#formatting)
    - [Testing](#testing)
    - [Review Process](#review-process)
    - [Getting help](#getting-help)
  - [Contribtuing new LLM Providers/Models](#contribtuing-new-llm-providersmodels)
    - [Adding an LLM Provider](#adding-an-llm-provider)
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

Continue is quickly adding features, and we'd love to hear which are the most important to you. The best ways to suggest an enhancement are:

- Create an issue

  - First, check whether a similar proposal has already been made
  - If not, [create an issue](https://github.com/continuedev/continue/issues)
  - Please describe the enhancement in as much detail as you can, and why it would be useful

- Join the [Continue Discord](https://discord.gg/NWtdYexhMs) and tell us about your idea in the `#feedback` channel

## 📖 Updating / Improving Documentation

Continue is continuously improving, but a feature isn't complete until it is reflected in the documentation! If you see something out-of-date or missing, you can help by clicking "Edit this page" at the bottom of any page on [docs.continue.dev](https://docs.continue.dev).

### Running the Documentation Server Locally

You can run the documentation server locally using either of the following methods:

#### Method 1: NPM Script

1. Open your terminal and navigate to the `docs` subdirectory of the project. The `docusaurus.config.js` file you'll see there is a sign you're in the right place.

2. Run the following command to install the necessary dependencies for the documentation server:

   ```bash
   npm install
   ```

3. Run the following command to start the documentation server:

   ```bash
   npm run start
   ```

#### Method 2: VS Code Task

1. Open VS Code in the root directory of the project.

2. Open the VS Code command pallet (`cmd/ctrl+shift+p`) and select `Tasks: Run Task`.

3. Look for the `docs:start` task and select it.

This will start a local server and you can see the documentation rendered in your default browser, typically accessible at `http://localhost:3000`.

## 🧑‍💻 Contributing Code

We welcome contributions from developers of all experience levels - from first-time contributors to seasoned open source maintainers. While we aim to maintain high standards for reliability and maintainability, our goal is to keep the process as welcoming and straightforward as possible.

### Environment Setup

#### Pre-requisites

You should have Node.js version 20.11.0 (LTS) or higher installed. You can get it on [nodejs.org](https://nodejs.org/en/download) or, if you are using NVM (Node Version Manager), you can set the correct version of Node.js for this project by running the following command in the root of the project:

```bash
nvm use
```

#### Fork the Continue Repository

1. Go to the [Continue GitHub repository](https://github.com/continuedev/continue) and fork it to your GitHub account.

2. Clone your forked repository to your local machine. Use: `git clone https://github.com/YOUR_USERNAME/continue.git`

3. Navigate to the cloned directory and make sure you are on the main branch. Create your feature/fix branch from there, like so: `git checkout -b 123-my-feature-branch`

4. Send your pull request to the main branch.

#### VS Code

1. Open the VS Code command pallet (`cmd/ctrl+shift+p`) and select `Tasks: Run Task` and then select `install-all-dependencies`

2. Start debugging:

   1. Switch to Run and Debug view
   2. Select `Launch extension` from drop down
   3. Hit play button
   4. This will start the extension in debug mode and open a new VS Code window with it installed
      1. The new VS Code window with the extension is referred to as the _Host VS Code_
      2. The window you started debugging from is referred to as the _Main VS Code_

3. To package the extension, run `npm run package` in the `extensions/vscode` directory, select `Tasks: Run Task` and then select `vscode-extension:package`. This will generate `extensions/vscode/build/continue-{VERSION}.vsix`, which you can install by right-clicking and selecting "Install Extension VSIX".

##### Debugging

**Breakpoints** can be used in both the `core` and `extensions/vscode` folders while debugging, but are not currently supported inside of `gui` code.

**Hot-reloading** is enabled with Vite, so if you make any changes to the `gui`, they should be automatically reflected without rebuilding. In some cases, you may need to refresh the _Host VS Code_ window to see the changes.

Similarly, any changes to `core` or `extensions/vscode` will be automatically included by just reloading the _Host VS Code_ window with cmd/ctrl+shift+p "Reload Window".

#### JetBrains

See [`intellij/CONTRIBUTING.md`](./extensions/intellij/CONTRIBUTING.md) for the JetBrains extension.

### Our Git Workflow

We keep a single permanent branch: `main`. When we are ready to create a "pre-release" version, we create a tag on the `main` branch titled `v0.9.x-vscode`, which automatically triggers the workflow in [preview.yaml](./.github/workflows/preview.yaml), which builds and releases a version of the VS Code extension. When a release has been sufficiently tested, we will create a new release titled `v0.8.x-vscode`, triggering a similar workflow in [main.yaml](./.github/workflows/main.yaml), which will build and release a main release of the VS Code extension. Any hotfixes can be made by creating a feature branch from the tag for the release in question. This workflow is well explained by <http://releaseflow.org>.

### Development workflow

- Open a new issue or comment on an existing one before writing code. This ensures your proposed changes are aligned with the project direction.
- Keep changes focused. Multiple unrelated fixes should be opened as separate PRs
- Write or update tests for new functionality
- Update relevant documentation in the `docs` folder
- Open a PR against the `main` branch. Make sure to fill in the PR template

### Formatting

Continue uses [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) to format JavaScript/TypeScript. Please install the Prettier extension in VS Code and enable "Format on Save" in your settings.

### Testing

We have a mix of unit, functional, and e2e test suites, with a primary focus on functional testing. These tests run on each pull request. If your PR causes one of these tests to fail, we will ask that you to resolve the issue before we merge.

When contributing, please update or create the appropriate tests to help verify the correctness of your implementaiton.

### Review Process

- **Initial Review** - A maintainer will be assigned as primary reviewer
- **Feedback Loop** - The reviewer may request changes. We value your work, but also want to ensure the code is maintainable and follows our patterns.
- **Approval & Merge** - Once the PR is approved, it will be merged into the `main` branch.

### Getting help

Join [#contribute on Discord](https://discord.gg/vapESyrFmJ) to engage with maintainers and other contributors.

## Contribtuing new LLM Providers/Models

### Adding an LLM Provider

Continue has support for more than a dozen different LLM "providers", making it easy to use models running on OpenAI, Ollama, Together, LM Studio, Msty, and more. You can find all of the existing providers [here](https://github.com/continuedev/continue/tree/main/core/llm/llms), and if you see one missing, you can add it with the following steps:

1. Create a new file in the `core/llm/llms` directory. The name of the file should be the name of the provider, and it should export a class that extends `BaseLLM`. This class should contain the following minimal implementation. We recommend viewing pre-existing providers for more details. The [LlamaCpp Provider](./core/llm/llms/LlamaCpp.ts) is a good simple example.

- `providerName` - the identifier for your provider.
- At least one of `_streamComplete` or `_streamChat` - This is the function that makes the request to the API and returns the streamed response. You only need to implement one because Continue can automatically convert between "chat" and "raw completion".

2. Add your provider to the `LLMs` array in [core/llm/llms/index.ts](./core/llm/llms/index.ts).
3. If your provider supports images, add it to the `PROVIDER_SUPPORTS_IMAGES` array in [core/llm/autodetect.ts](./core/llm/autodetect.ts).
4. Add the necessary JSON Schema types to [`config_schema.json`](./extensions/vscode/config_schema.json). This makes sure that Intellisense shows users what options are available for your provider when they are editing `config.json`.
5. Add a documentation page for your provider in [`docs/docs/customize/model-providers`](./docs/docs/customize/model-providers). This should show an example of configuring your provider in `config.json` and explain what options are available.

### Adding Models

While any model that works with a supported provider can be used with Continue, we keep a list of recommended models that can be automatically configured from the UI or `config.json`. The following files should be updated when adding a model:

- [config_schema.json](./extensions/vscode/config_schema.json) - This is the JSON Schema definition that is used to validate `config.json`. You'll notice a number of rules defined in "definitions.ModelDescription.allOf". Here is where you write rules that can specify something like "for the provider 'anthropic', only models 'claude-2' and 'claude-instant-1' are allowed. Look through all of these rules and make sure that your model is included for providers that support it.
- [AddNewModel page](./gui/src/pages/AddNewModel) - This directory defines which model options are shown in the side bar model selection UI. To add a new model:
  1. Add a `ModelPackage` entry for the model into [configs/models.ts](./gui/src/pages/AddNewModel/configs/models.ts), following the lead of the many examples near the top of the file
  2. Add the model within its provider's array to [AddNewModel.tsx](./gui/src/pages/AddNewModel/AddNewModel.tsx) (add provider if needed)
- [index.d.ts](./core/index.d.ts) - This file defines the TypeScript types used throughout Continue. You'll find a `ModelName` type. Be sure to add the name of your model to this.
- LLM Providers: Since many providers use their own custom strings to identify models, you'll have to add the translation from Continue's model name (the one you added to `index.d.ts`) and the model string for each of these providers: [Ollama](./core/llm/llms/Ollama.ts), [Together](./core/llm/llms/Together.ts), and [Replicate](./core/llm/llms/Replicate.ts). You can find their full model lists here: [Ollama](https://ollama.ai/library), [Together](https://docs.together.ai/docs/inference-models), [Replicate](https://replicate.com/collections/streaming-language-models).
- [Prompt Templates](./core/llm/index.ts) - In this file you'll find the `autodetectTemplateType` function. Make sure that for the model name you just added, this function returns the correct template type. This is assuming that the chat template for that model is already built in Continue. If not, you will have to add the template type and corresponding edit and chat templates.

## 📐 Continue Architecture

Continue consists of 2 parts that are split so that it can be extended to work in other IDEs as easily as possible:

1. **Continue GUI** - The Continue GUI is a React application that gives the user control over Continue. It displays the current chat history, allows the user to ask questions, invoke slash commands, and use context providers. The GUI also handles most state and holds as much of the logic as possible so that it can be reused between IDEs.

2. **Continue Extension** - The Continue Extension is a plugin for the IDE which implements the [IDE Interface](./core/index.d.ts#L229). This allows the GUI to request information from or actions to be taken within the IDE. This same interface is used regardless of IDE. The first Continue extensions we have built are for VS Code and JetBrains, but we plan to build clients for other IDEs in the future. The IDE Client must 1. implement IDE Interface, as is done [here](./extensions/vscode/src/VsCodeIde.ts) for VS Code and 2. display the Continue GUI in a sidebar, like [here](./extensions/vscode/src/ContinueGUIWebviewViewProvider.ts).

### Continue VS Code Extension

The starting point for the VS Code extension is [activate.ts](./extensions/vscode/src/activation/activate.ts). The `activateExtension` function here will register all commands and load the Continue GUI in the sidebar of the IDE as a webview.

### Continue JetBrains Extension

The JetBrains extension is currently in alpha testing. Please reach out on [Discord](https://discord.gg/vapESyrFmJ) if you are interested in contributing to its development.
