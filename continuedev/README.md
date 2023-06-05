# Continue PyPI Package

This package contains the [Continue](https://github.com/continuedev.com/continue) server and core classes needed to build your own recipes.

Continue is a Python library for automating repetitive sequences of software development tasks using language models. Using our VS Code extension, you can build, run, and refine these recipes as they natively interact with your codebase. Read the docs [here](https://continuedev.netlify.app/) or download the VS Code extension [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

## Continue Server

The Continue server acts as a bridge between the Continue React app and your IDE, running your recipes and acting on the codebase. 

Start it by running the following commands:
1. `cd continuedev`
2. Make sure packages are installed with `poetry install`
3. `poetry shell`
4. `cd ..`
5. `python3 -m continuedev.src.continuedev.server.main`

## Scripts

`poetry run typegen` to generate JSONSchema .json files from the Pydantic types defined in the `models` directory.

`poetry build` will output wheel and tarball files in `./dist`.

## Writing Steps

See the `src/continuedev/libs/steps` folder for examples of writing a Continue step. See our documentation for tutorials.
