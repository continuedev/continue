# How `Continue` works

![Continue Architecture Diagram](/img/continue-architecture.png)

## Overview

The `Continue` library consists of an [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Server](./concepts/server.md) that brings everything together.

The [SDK](./concepts/sdk.md) gives you access to the tools (e.g. open a directory, edit a file, call a model, etc.) needed to define steps that integrate LLMs into your IDE.

The [GUI](./concepts/gui.md) lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.

The [Server](./concepts/server.md) holds the main event loop, responsible for connecting IDE, SDK, and GUI and deciding which steps to take next.

## Details

**TODO: Refactor all of this and make it fit with language above**

- Continue connects any code editor (primarily VS Code right now) to a server (the Continue server) that can take actions in the editor in accordance with defined recipes at the request of a user through the GUI
- What this looks like:
  - The Continue VS Code extension runs the ContinueIdeProtocol, launches the Continue Python server in the background, and opens the Continue GUI in a side-panel.
  - The Continue server is the brain, communication center, and source of truth, interacting with VS Code through the ContinueIdeProtocol and with the GUI through the NotebookProtocol.
  - Communication between the extension and GUI happens through the Continue server.
  - When you type a natural language command in the GUI, this is sent to the Continue server, where the `Autopilot` class takes action, potentially using the ContinueIdeProtocol to request actions be taken in the IDE, and then updates the GUI to display the new history.
- `core` directory contains major concepts
  - This includes Autopilot, Policy, SDK (all in their own files so far)
  - It also includes `main.py`, which contains History, HistoryNode, Step, and others
  - You'll find `env.py` here too, which is a common place to load environment variables, which can then be imported from here
- `libs` contains misc. stuff
- `llm` for language model utilities
- `steps` for builtin Continue steps
- `util` for very misc. stuff
- `chroma` for chroma code that deals with codebase embeddings
- `models` contains all the Pydantic models and `generate_json_schema.py`, a script that converts them to JSONSchema .json files in `schema/json`
- `server` runs the servers that communicate with a) the React app (`notebook.py`) and b) the IDE (`ide.py`)
- `ide_protocol.py` is just the abstract version of what is implemented in `ide.py`, and `main.py` runs both `notebook.py` and `ide.py` as a single FastAPI server. This is the entry point to the Continue server, and acts as a bridge between IDE and React app
- We use OpenAPI/JSONSchema to define types so that it's really easy to bring them across language barriers. Use Pydantic types, then run `poetry run typegen` from the root of continuedev folder to generate JSONSchema json files in the `schema/json` folder. Then `npm run typegen` from the extension folder generates the types that are used within the extension.