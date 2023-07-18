# Contributing to Continue

## Table of Contents

- [Continue Architecture](#continue-architecture)
- [Core Concepts](#core-concepts)
  - [Step](#step)
- [Continue VS Code Client](#continue-vs-code-client)
- [Continue IDE Websockets Protocol](#continue-ide-websockets-protocol)
- [Continue GUI Websockets Protocol](#continue-gui-websockets-protocol)
- [Ways to Contribute](#ways-to-contribute)
  - [Report Bugs](#report-bugs)
  - [Suggest Enhancements](#suggest-enhancements)
  - [Updating / Improving Documentation](#updating--improving-documentation)

## Continue Architecture

Continue consists of 3 components, designed so that Continue can easily be extended to work in any IDE:

1. **Continue Server** - The Continue Server is responsible for keeping state, running the autopilot loop which takes actions, and communicating between the IDE and GUI.

2. **Continue IDE Client** - The Continue IDE Client is a plugin for the IDE which implements the Continue IDE Protocol. This allows the server to request actions to be taken within the IDE, for example if `sdk.ide.setFileOpen("main.py")` is called on the server, it will communicate over websocketes with the IDE, which will open the file `main.py`. The first IDE Client we have built is for VS Code, but we plan to build clients for other IDEs in the future. The IDE Client must 1. implement the websockets protocol, as is done [here](./extension/src/continueIdeClient.ts) for VS Code and 2. launch the Continue Server, like [here](./extension/src/activation/environmentSetup.ts), and 3. display the Continue GUI in a sidebar, like [here](./extension/src/debugPanel.ts).

3. **Continue GUI** - The Continue GUI is a React application that gives the user control over Continue. It displays the history of Steps, shows what context is included in the current Step, and lets the users enter natural language or slash commands to initiate new Steps. The GUI communicates with the Continue Server over its own websocket connection

It is important that the IDE Client and GUI never communicate except when the IDE Client initially sets up the GUI. This ensures that the server is the source-of-truth for state, and that we can easily extend Continue to work in other IDEs.

![Continue Architecture](https://continue.dev/docs/assets/images/continue-architecture-146a90742e25f6524452c74fe44fa2a0.png)

## Core Concepts

All of Continue's logic happens inside of the server, and it is built around a few core concepts. Most of these are Pydantic Models defined in [core/main.py](./continuedev/src/continuedev/core/main.py).

### `Step`

Everything in Continue is a "Step". The `Step` class defines 2 methods:

1. `async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]` - This method defines what happens when the Step is run. It has access to the Continue SDK, which lets you take actions in the IDE, call LLMs, run nested Steps, and more. Optionally, a Step can return an `Observation` object, which a `Policy` can use to make decisions about what to do next.

2. `async def describe(self, models: Models) -> Coroutine[str, None, None]` - After each Step is run, this method is called to asynchronously generate a summary title for the step. A `Models` object is passed so that you have access to LLMs to summarize for you.

Steps are designed to be composable, so that you can easily build new Steps by combining existing ones. And because they are Pydantic models, they can instantly be used as tools useable by an LLM, for example with OpenAI's function-calling functionality (see [ChatWithFunctions](./continuedev/src/continuedev/steps/chat.py) for an example of this).

Some of the most commonly used Steps are:

- [`SimpleChatStep`](./continuedev/src/continuedev/steps/chat.py) - This is the default Step that is run when the user enters natural language input. It takes the user's input and runs it through the default LLM, then displays the result in the GUI.

- [`EditHighlightedCodeStep`](./continuedev/src/continuedev/steps/core/core.py) - This is the Step run when a user highlights code, enters natural language, and presses CMD/CTRL+ENTER, or uses the slash command '/edit'. It opens a side-by-side diff editor, where updated code is streamed to fulfil the user's request.

### `Autopilot`

### `Observation`

### `Policy`

### Continue VS Code Client

The starting point for the VS Code extension is [activate.ts](./extension/src/activation/activate.ts). The `activateExtension` function here will:

1. Check whether the current version of the extension is up-to-date and, if not, display a notification

2. Initialize the Continue IDE Client and establish a connection with the Continue Server

3. Load the Continue GUI in the sidebar of the IDE and begin a new session

### Continue IDE Websockets Protocol

On the IDE side, this is implemented in [continueIdeClient.ts](./extension/src/continueIdeClient.ts). On the server side, this is implemented in [ide.py](./continuedev/src/continuedev/server/ide.py). You can see [ide_protocol.py](./continuedev/src/continuedev/server/ide_protocol.py) for the protocol definition.

### Continue GUI Websockets Protocol

On the GUI side, this is implemented in [ContinueGUIClientProtocol.ts](./extension/react-app/src/hooks/ContinueGUIClientProtocol.ts). On the server side, this is implemented in [gui.py](./continuedev/src/continuedev/server/gui.py). You can see [gui_protocol.py](./continuedev/src/continuedev/server/gui_protocol.py) or [AbstractContinueGUIClientProtocol.ts](./extension/react-app/src/hooks/AbstractContinueGUIClientProtocol.ts) for the protocol definition.

When state is updated on the server, we currently send the entirety of the object over websockets to the GUI. This will of course have to be improved soon. The state object, `FullState`, is defined in [core/main.py](./continuedev/src/continuedev/core/main.py) and includes:

- `history`, a record of previously run Steps. Displayed in order in the sidebar.
- `active`, whether the autopilot is currently running a step. Displayed as a loader while step is running.
- `user_input_queue`, the queue of user inputs that have not yet been processed due to waiting for previous Steps to complete. Displayed below the `active` loader until popped from the queue.
- `default_model`, the default model used for completions. Displayed as a toggleable button on the bottom of the GUI.
- `highlighted_ranges`, the ranges of code that have been selected to include as context. Displayed just above the main text input.
- `slash_commands`, the list of available slash commands. Displayed in the main text input dropdown.
- `adding_highlighted_code`, whether highlighting of new code for context is locked. Displayed as a button adjacent to `highlighted_ranges`.

Updates are sent with `await sdk.update_ui()` when needed explicitly or `await autopilot.update_subscribers()` automatically between each Step. The GUI can listen for state updates with `ContinueGUIClientProtocol.onStateUpdate()`.

## Ways to Contribute

### Report Bugs

### Suggest Enhancements

### Updating / Improving Documentation

Continue is continuously improving, but a feature isn't complete until it is reflected in the documentation!
