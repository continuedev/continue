# Continue PyPI Package

This package contains the [Continue](https://github.com/continuedev/continue) server and core classes needed to build your own recipes.

Continue is a Python library for automating repetitive sequences of software development tasks using language models. Using our VS Code extension, you can build, run, and refine these recipes as they natively interact with your codebase. Read the docs [here](https://continue.dev/docs) or download the VS Code extension [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

## Continue Server

The Continue server acts as a bridge between the Continue React app and your IDE, running your recipes and acting on the codebase.

Start it by running the following commands:

1. `cd server`
2. Make sure packages are installed with `poetry install`
   - If poetry is not installed, you can install with
   ```bash
   curl -sSL https://install.python-poetry.org | python3 -
   ```
   (official instructions [here](https://python-poetry.org/docs/#installing-with-the-official-installer))
3. `poetry shell` to activate the virtual environment
4. `python3 -m continuedev.server.main` to start the server

Once you've validated that this works, you'll often want to use a debugger, in which case we've provided a launch configuration for VS Code in `.vscode/launch.json`. To start the debugger in VS Code, ensure that the workspace directory is the root of the `continue` repo, then press F5.

> [!NOTE]
> To start the debugger, you'll have to select the poetry Python interpreter
> (`/path-to-poetry-venv/bin/python3`) in the bottom right of the VS Code window. If you
> don't see this, you may have to install the [Python
> extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python).

## Scripts

`poetry run typegen` to generate JSONSchema .json files from the Pydantic types defined in the `models` directory.

`poetry build` will output wheel and tarball files in `./dist`.

## Writing Steps

See the `continuedev/libs/steps` folder for examples of writing a Continue step. See our documentation for tutorials.

## How to contribute

Open a [new GitHub Issue](https://github.com/continuedev/continue/issues/new) or comment on [an existing one](https://github.com/continuedev/continue/issues). Let us know what you would like to contribute, and we will help you make it happen!

For more a more detailed contributing guide, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Install from source

#### 1. Clone this repo

Recommended: Run this command to use SSH

```bash
git clone git@github.com:continuedev/continue.git
```

Alternative: Run this command to use HTTPS

```bash
git clone https://github.com/continuedev/continue
```

#### 2. Install Continue

Run this command to use the install script

```bash
cd continue/extensions/vscode/scripts && python3 install_from_source.py
```

> [!IMPORTANT]
> Ensure you have a Java Runtime Environment (JRE) installed. Verify this by typing `java
-version` in your command prompt or terminal. If a version number appears, you're set.
> If not, download and install a JRE from Oracle's website or through a package manager,
> for example Homebrew.
>
> ```sh
> brew install openjdk@11
> ```

# Understanding the codebase

- [Continue Server README](./README.md): learn about the core of Continue, which can be downloaded as a [PyPI package](https://pypi.org/project/continuedev/)
- [VS Code Extension README](../extensions/vscode/README.md): learn about the capabilities of our extension—the first implementation of Continue's IDE Protocol—which makes it possible to use use Continue in VS Code and GitHub Codespaces
- [Continue GUI README](../gui/): learn about the React app that lets users interact with the server and is placed adjacent to the text editor in any supported IDE
- [Schema README](../schema/README.md): learn about the JSON Schema types generated from Pydantic models, which we use across the `server/` and `extensions/vscode/` directories
- [Continue Docs README](../docs/README.md): learn how our [docs](https://continue.dev/docs) are written and built
- [How to debug the VS Code Extension README](../extensions/vscode/src/README.md): learn how to set up the VS Code extension, so you can debug it
