# How `Continue` works

*TODO: Describe in more detail how `Continue` works*

## Overview

The `Continue` library consists of a [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Core](./concepts/core.md) that brings everything together.

The [SDK](./concepts/sdk.md) gives you access to tools (e.g. open a directory, edit a file, call a model, etc), which you can use when defining how a step should work and composing them with other steps.

The [GUI](./concepts/gui.md) enables you to guide steps and makes everything transparent, so you can review all steps that were automated, giving you the opportunity to undo and rerun any that ran incorrectly.

The [Core](./concepts/core.md) connects the SDK and GUI with the IDE (i.e. in VS Code, a web browser, etc), enabling the steps to make changes to your code and accelerate your software development workflows.

## What to know about codebase

- `core` directory contains major concepts
    - This includes Autopilot, Policy, SDK (all in their own files  so far)
    - It also includes  `main.py`, which contains History, HistoryNode, Step, and others
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