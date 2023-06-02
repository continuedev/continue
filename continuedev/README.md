# Continue PyPI Package

Continue is a Python library for automating repetitive sequences of software development tasks using language models. Using our VS Code extension, you can build, run, and refine these recipes as they natively interact with your codebase. Download on [our GitHub](https://github.com/continuedev/continue).

## Continue Server

The Continue server acts as a bridge between the Continue React app and your IDE, running your recipes and acting on the codebase. Start it by running the following commands:

- `cd continuedev`
- Make sure packages are installed with `poetry install`
- `poetry shell`
- `cd ..`
- `python3 -m continuedev.src.continuedev.server.main`

## Scripts

`poetry run typegen` to generate JSONSchema .json files from the Pydantic types defined in the `models` directory.

`poetry build` will output wheel and tarball files in `./dist`.

## Writing Steps

See the `src/continuedev/libs/steps` folder for examples of writing a Continue step. See our documentation for tutorials.
