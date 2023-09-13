# ⚙️ How Continue works

![Continue Architecture Diagram](/img/continue-diagram.png)

## Overview

- Continue is typically used inside of an Integrated Development Environment (IDE) like VS Code or JetBrains
- All units of action in Continue are called steps. Steps can be recursively composed into more complex steps
- Steps have access to the SDK, which enables you to use LLMs in your workflows (e.g. edit a file, call a model, etc)
- The Server facilitates communication between the IDE and the GUI and determines what steps to take next
- The GUI enables you to review every automated step, giving you the opportunity to undo and rerun any or all
- It is also possible to run Continue in headless, asynchronous mode. Please reach out if you are interested in this!

## Supported IDEs

### VS Code (Beta)

Continue can be used as a VS Code extension. 

You can install it from the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

### JetBrains (Alpha)

Continue can be used as a plugin inside of PyCharm, Intellij, WebStorm, etc. 

You can install it from the JetBrains Marketplace [here](https://continue.dev/).

### Add Continue to a new IDE

Here is how you can get started with adding Continue to a new IDE:

1. Let us know that you would like to add Continue to a new IDE by opening an issue [here](https://github.com/continuedev/continue/issues/new/choose)
2. Implement a class that maps each of the actions like "read file" to the API provided by that IDE like [here](https://github.com/continuedev/continue/blob/main/extension/src/continueIdeClient.ts)
3. Learn more about what you might also do by looking at this pull request that added initial support for JetBrains [here](https://github.com/continuedev/continue/pull/457)

## Running the server manually

If you would like to run the Continue server manually, rather than allowing the VS Code to set it up, you can follow these steps:

1. `git clone https://github.com/continuedev/continue`
2. `cd continue/continuedev`
3. Make sure packages are installed with `poetry install`
   - If poetry is not installed, you can install with
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```
   (official instructions [here](https://python-poetry.org/docs/#installing-with-the-official-installer))
4. `poetry shell` to activate the virtual environment
5. Either:

   a) To run without the debugger: `cd ..` and `python3 -m continuedev.src.continuedev.server.main`

   b) To run with the debugger: Open a VS Code window with `continue` as the root folder. Ensure that you have selected the Python interpreter from virtual environment, then use the `.vscode/launch.json` we have provided to start the debugger.
