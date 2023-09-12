# ⚙️ How Continue works

![Continue Architecture Diagram](/img/continue-architecture.png)

The `Continue` library consists of an **SDK**, a **GUI**, and a **Server** that brings everything together.

1. The **SDK** gives you access to the tools (e.g. open a directory, edit a file, call a model, etc.) needed to define steps that integrate LLMs into your IDE and workflows.

2. The **GUI** lets you transparently review every automated step, providing the opportunity to undo and rerun any that ran incorrectly.

3. The **Server** is responsible for connecting the GUI and SDK to the IDE as well as deciding which steps to take next.

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
