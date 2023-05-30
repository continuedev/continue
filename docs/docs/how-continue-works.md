# How `Continue` works

*TODO: Describe in more detail how `Continue` works*

The `Continue` library consists of a [SDK](./concepts/sdk.md), a [GUI](./concepts/gui.md), and a [Core](./concepts/core.md) that brings everything together.

The [SDK](./concepts/sdk.md) gives you access to tools (e.g. open a directory, edit a file, call a model, etc), which you can use when defining how a step should work and composing them with other steps.

The [GUI](./concepts/gui.md) enables you to guide steps and makes everything transparent, so you can review all steps that were automated, giving you the opportunity to undo and rerun any that ran incorrectly.

The [Core](./concepts/core.md) connects the SDK and GUI with the IDE (i.e. in VS Code, a web browser, etc), enabling the steps to make changes to your code and accelerate your software development workflows.

### continuedev

`core` folder contains major concepts, including Agent, Observation (sunsetting this potentially), Policy, SDK (all so far in their own files), and in `main.py`, History, HistoryNode, Step, and others. `env.py` is a common place to load environment variables, which can then be imported from here.

`libs` contains misc. stuff. `llm` for language model utilities. `steps` for builtin Continue steps. `util` for very misc. stuff. `chroma` for chroma code that deals with codebase embeddings.

`models` contains all the Pydantic models and `generate_json_schema.py`, a script that converts them to JSONSchema .json files in `schema/json`.

`plugins` not really used, was from when I was using pluggy. I'll delete.

`server` runs the servers that communicate with a) the React app (`notebook.py`) and b) the IDE (`ide.py`). `ide_protocol.py` is just the abstract version of what is implemented in `ide.py`, and `main.py` runs both `notebook.py` and `ide.py` as a single FastAPI server. This is the entry point to the Continue server, and acts as a bridge between IDE and React app.

### docs

Self-explanatory, but Docusaurus

### extension

Contains 1. The VS Code extension, whose code is in `extension/src`, with `extension.ts` being the entry point, and 2. the Continue React app, in the `extension/react-app` folder. This is displayed in the sidebar of VSCode, but is designed to work with any IDE that implements the protocol as is done in `extension/src/continueIdeClient.ts`.

### schema

We use OpenAPI/JSONSchema to define types so that it's really easy to bring them across language barriers. Use Pydantic types, then run `poetry run typegen` from the root of continuedev folder to generate JSONSchema json files in the `schema/json` folder. Then `npm run typegen` from the extension folder generates the types that are used within the extension.

---

### GENERAL INFORMATION

The Continue `Agent` class is the main loop, completing Steps and then deciding the next step and repeating. An Agent has a `Policy`, which decides what step to take next. An Agent takes user input from the React app. You can see this happening in `server/notebook.py`. It basically queues user inputs, pops off the most recent, runs that as a "UserInputStep", uses its Policy to run other steps until the next step is None, and then pops off the next user input. When nothing left, just waits for more.

The Policy is where slash commands are defined. The Policy is a global thing, so probably something we'll want to make user-configurable if we don't significantly change it.

A `Step` is a Pydantic class inheriting from `Step`. Steps implement the `run` method, which takes a ContinueSDK as its only parameter. The ContinueSDK gives all the utilities you need to easily write recipes (Steps). It also implements the `describe` method, which just computes a textual description of what happened when the `run` method was called. Can save attributes in `run` if you want, or just have a default `describe`, or not even implement it, in which case the name of the class is used. Any parameters to a Step are defined as attributes to the class without a double leading underscore (those with this are private).

The ContinueSDK has a `run_step` method, which allows Steps to be composable. The reason you want to run it with `run_step` instead of creating a Step and calling `step.run(...)` is so Continue can automatically keep track of the order of all steps run, and allow for reversibility, etc... The ContinueSDK also contains functions for very common steps, like `edit_file`, `add_file`, `run` (to run shell commands), and a few others. `sdk.history` lets you access the history of past steps. `sdk.llm` lets you use the Agent's language model like `sdk.llm.complete`. `sdk.ide` lets you take any action within the connected IDE (this is where the IDE protocol is called).