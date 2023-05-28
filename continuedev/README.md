# Continue

Continue is a Python library for automating repetitive sequences of software development tasks using language models. Using our VS Code extension, you can build, run, and refine these recipes as they natively interact with your codebase. Download on [our GitHub](https://github.com/continuedev/continue).

## Steps to start

- `cd continue/continue`
- Make sure packages are installed with `poetry install`
- `poetry shell`
- `cd ..`
- `python3 -m continuedev.src.continuedev`

## Steps to generate JSON Schema

Same up until last step and then `python3 -m continuedev.src.scripts.gen_json_schema`.

## Start the server

Same steps, then `uvicorn continue.src.server.main:app --reload`.

## To build

Run `poetry build` and it will output wheel and tarball files in `./dist`.

## Writing Steps

See the `src/continuedev/libs/steps` folder for examples of writing a Continue step.
