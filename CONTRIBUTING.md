# Contributing to Continue

## Table of Contents

- [Contributing to Continue](#contributing-to-continue)
  - [Table of Contents](#table-of-contents)
- [❤️ Ways to Contribute](#️-ways-to-contribute)
  - [👋 Continue Contribution Ideas](#-continue-contribution-ideas)
  - [🐛 Report Bugs](#-report-bugs)
  - [✨ Suggest Enhancements](#-suggest-enhancements)
  - [📖 Updating / Improving Documentation](#-updating--improving-documentation)
  - [🧑‍💻 Contributing Code](#-contributing-code)
    - [Environment Setup](#environment-setup)
    - [Writing Steps](#writing-steps)
    - [Writing Context Providers](#writing-context-providers)
  - [📐 Continue Architecture](#-continue-architecture)
    - [Continue VS Code Client](#continue-vs-code-client)
    - [Continue IDE Websockets Protocol](#continue-ide-websockets-protocol)
    - [Continue GUI Websockets Protocol](#continue-gui-websockets-protocol)
  - [❇️ Core Concepts](#️-core-concepts)
    - [`Step`](#step)
    - [`Autopilot`](#autopilot)
    - [`Observation`](#observation)
    - [`Policy`](#policy)

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

### Environment Setup

VSCode is assumed for development as Continue is primarily a VSCode tool at the moment. Most of the setup and running is automated through VSCode tasks and launch configurations.

1. Clone and open in VSCode the Continue repo `https://github.com/continuedev/continue`

2. Open VSCode command pallet (`cmd+shift+p`) and select `Tasks: Run Task` and then select `install-all-dependencies`

3. Start debugging:

   1. Switch to Run and Debug view
   2. Select `Server + Extension (VSCode)` from drop down
   3. Hit play button
   4. This will start both the server and the extension in debug mode and open a new VSCode window with continue extension
      1. I call the VSCode window with the extension the _Host VSCode_
      2. The window you started debugging from is referred to as the _Main VSCode_
   5. Notice 2 debug sessions are running, one for the server and one for the extension, you can also set breakpoints in both

4. Lets try using breakpoints:
   1. _In Main VSCode_:
      1. Search for `class IdeProtocolServer` and set a breakpoint in `handle_json`, this is the method invoked on every message received from the extension related to selection changes, file opens etc
      2. Search for a method `sendHighlightedCode` and set a breakpoint in it, it is invoked on every selection change on the extension side
   2. _In Host VSCode_: Select part of the `example.ts` file, your breakpoint should be hit. If you hit play at this point (or F5) you should see the original breakpoint hit again - congratulations, you debugged an end to end interaction from the extension to the server!

### Writing Steps

A Step can be used as a custom slash command, or called otherwise in a `Policy`. See the [steps README](./server/continuedev/plugins/steps/README.md) to learn how to write a Step.

### Writing Context Providers

A `ContextProvider` is a Continue plugin that lets type '@' to quickly select documents as context for the language model. The simplest way to create a `ContextProvider` is to implement the `provide_context_items` method. You can find a great example of this in [GitHubIssuesContextProvider](./server/continuedev/plugins/context_providers/github.py), which allows you to search GitHub Issues in a repo.

## 📐 Continue Architecture

Continue consists of 3 components, designed so that Continue can easily be extended to work in any IDE:

1. **Continue Server** - The Continue Server is responsible for keeping state, running the autopilot loop which takes actions, and communicating between the IDE and GUI.

2. **Continue IDE Client** - The Continue IDE Client is a plugin for the IDE which implements the Continue IDE Protocol. This allows the server to request actions to be taken within the IDE, for example if `sdk.ide.setFileOpen("main.py")` is called on the server, it will communicate over websocketes with the IDE, which will open the file `main.py`. The first IDE Client we have built is for VS Code, but we plan to build clients for other IDEs in the future. The IDE Client must 1. implement the websockets protocol, as is done [here](./extensions/vscode/src/continueIdeClient.ts) for VS Code and 2. launch the Continue Server, like [here](./extensions/vscode/src/activation/environmentSetup.ts), and 3. display the Continue GUI in a sidebar, like [here](./extensions/vscode/src/debugPanel.ts).

3. **Continue GUI** - The Continue GUI is a React application that gives the user control over Continue. It displays the history of Steps, shows what context is included in the current Step, and lets the users enter natural language or slash commands to initiate new Steps. The GUI communicates with the Continue Server over its own websocket connection

It is important that the IDE Client and GUI never communicate except when the IDE Client initially sets up the GUI. This ensures that the server is the source-of-truth for state, and that we can easily extend Continue to work in other IDEs.

![Continue Architecture](https://continue.dev/docs/assets/images/continue-architecture-146a90742e25f6524452c74fe44fa2a0.png)

### Continue VS Code Client

The starting point for the VS Code extension is [activate.ts](./extensions/vscode/src/activation/activate.ts). The `activateExtension` function here will:

1. Check whether the current version of the extension is up-to-date and, if not, display a notification

2. Initialize the Continue IDE Client and establish a connection with the Continue Server

3. Load the Continue GUI in the sidebar of the IDE and begin a new session

### Continue JetBrains Client

The JetBrains extension is currently in alpha testing. Please reach out on [Discord](https://discord.gg/vapESyrFmJ) if you are interested in contributing to its development.

### Continue IDE Websockets Protocol

On the IDE side, this is implemented in [continueIdeClient.ts](./extensions/vscode/src/continueIdeClient.ts). On the server side, this is implemented in [ide.py](./continuedev/src/continuedev/server/ide.py). You can see [ide_protocol.py](./continuedev/src/continuedev/server/ide_protocol.py) for the protocol definition.

### Continue GUI Websockets Protocol

On the GUI side, this is implemented in [ContinueGUIClientProtocol.ts](./gui/src/hooks/ContinueGUIClientProtocol.ts). On the server side, this is implemented in [gui.py](./continuedev/src/continuedev/server/gui.py). You can see [gui_protocol.py](./continuedev/src/continuedev/server/gui_protocol.py) or [AbstractContinueGUIClientProtocol.ts](./gui/src/hooks/AbstractContinueGUIClientProtocol.ts) for the protocol definition.

When state is updated on the server, we currently send the entirety of the object over websockets to the GUI. This will of course have to be improved soon. The state object, `FullState`, is defined in [core/main.py](./server/continuedev/core/main.py) and includes:

- `history`, a record of previously run Steps. Displayed in order in the sidebar.
- `active`, whether the autopilot is currently running a step. Displayed as a loader while step is running.
- `user_input_queue`, the queue of user inputs that have not yet been processed due to waiting for previous Steps to complete. Displayed below the `active` loader until popped from the queue.
- `selected_context_items`, the ranges of code and other items (like GitHub Issues, files, etc...) that have been selected to include as context. Displayed just above the main text input.
- `slash_commands`, the list of available slash commands. Displayed in the main text input dropdown.
- `adding_highlighted_code`, whether highlighting of new code for context is locked. Displayed as a button adjacent to `highlighted_ranges`.

Updates are sent with `await sdk.update_ui()` when needed explicitly or `await autopilot.update_subscribers()` automatically between each Step. The GUI can listen for state updates with `ContinueGUIClientProtocol.onStateUpdate()`.

## ❇️ Core Concepts

All of Continue's logic happens inside of the server, and it is built around a few core concepts. Most of these are Pydantic Models defined in [core/main.py](./server/continuedev/core/main.py).

### `Step`

Everything in Continue is a "Step". The `Step` class defines 2 methods:

1. `async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]` - This method defines what happens when the Step is run. It has access to the Continue SDK, which lets you take actions in the IDE, call LLMs, run nested Steps, and more. Optionally, a Step can return an `Observation` object, which a `Policy` can use to make decisions about what to do next.

2. `async def describe(self, models: Models) -> Coroutine[str, None, None]` - After each Step is run, this method is called to asynchronously generate a summary title for the step. A `Models` object is passed so that you have access to LLMs to summarize for you.

Steps are designed to be composable, so that you can easily build new Steps by combining existing ones. And because they are Pydantic models, they can instantly be used as tools useable by an LLM, for example with OpenAI's function-calling functionality (see [ChatWithFunctions](./server/continuedev/plugins/steps/chat.py) for an example of this).

Some of the most commonly used Steps are:

- [`SimpleChatStep`](./server/continuedev/plugins/steps/chat.py) - This is the default Step that is run when the user enters natural language input. It takes the user's input and runs it through the default LLM, then displays the result in the GUI.

- [`EditHighlightedCodeStep`](./server/continuedev/plugins/steps/main.py) - This is the Step run when a user highlights code, enters natural language, and presses CMD/CTRL+ENTER, or uses the slash command '/edit'. It opens a side-by-side diff editor, where updated code is streamed to fulfil the user's request.

### `Autopilot`

In [autopilot.py](./server/continuedev/core/autopilot.py), we define the `Autopilot` class, which is the central entity responsible for keeping track of state and running the input/action loop.

### `Observation`

An `Observation` is a simple Pydantic model that can be used as a trigger to run a `Step`. For example, if running one `Step` results in an error, this can be returned as an `Observation` that can be used to trigger a `Step` that fixes the error. This is not being used frequently in the codebase right now, but we plan to use it as the basis of various "hooks" that will aid in the development of agents acting within the IDE.

### `Policy`

A `Policy` implements the method `def next(self, config: ContinueConfig, history: History) -> Step`, which decides which `Step` the `Autopilot` should run next. The default policy is defined [here](./server/continuedev/core/policies/default.py) and runs `SimpleChatStep` by default, or a slash command when the input begins with '/'. It also displays a welcome message at the beginning of each session. If interested in developing agents that autonomously take longer sequences of actions in the IDE, the `Policy` class is the place to start.
