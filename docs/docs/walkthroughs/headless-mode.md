# Headless Mode

"Headless mode" allows Continue to run in the background, without needing to be connected to the IDE or GUI. This is useful for performing refactors or other long-running tasks asynchronously. Headless mode can also be run in CI/CD for example to perform a thorough review for errors.

To use headless mode:

1. `pip install continuedev` (using a virtual environment is recommended)
2. Import `continuedev` and call `run_step_headless` with the `Step` you would like to run

Example:

Say you have the following file (`/path/to/file.py`):

```python
def say_hello(name: str):
    print(f"Hello, {name}")
```

and this function is imported and used in multiple places throughout your codebase. But the name parameter is new, and you need to change the function call everywhere it is used. You can use the script below to edit all usages of the function in your codebase:

```python
from continuedev.headless import run_step_headless
from continuedev.models.main import Position, PositionInFile
from continuedev.plugins.steps.refactor import RefactorReferencesStep

step = RefactorReferencesStep(
    user_input="",
    symbol_location=PositionInFile(
        filepath="/path/to/file.py",
        position=Position(line=0, character=5),
    ),
)
run_step_headless(step=step)
```

Here we use Continue's built-in `RefactorReferencesStep`. By passing it the location (filepath and position) of the symbol (function, variable, etc.) that we want to update, Continue will automatically find all references to that symbol and prompt an LLM to make the edit requested in the `user_input` field.
