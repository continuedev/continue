# This is a collaborative collection of Continue recipes

A recipe is technically just a [Step](../steps/README.md), but is intended to be more complex, composed of multiple sub-steps.

Recipes here will automatically be made available in the [Continue VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

The `recipes` folder contains all recipes, each with the same structure. **If you wish to create your own recipe, please do the following:**

1. Create a new subfolder in `recipes`, with the name of your recipe (for example `MyNewRecipe`).
2. Make 2 files in this folder: 1) a `README.md` describing your recipe and how to use it and 2) a `main.py` including a single class with the name of your recipe (e.g. `MyNewRecipe`).
3. Write any utility code other than the main recipe class in a separate file, which you can import in `main.py`. Particularly if you decide to break the recipe into multiple sub-steps, try to keep these separate.

# Existing Recipes

`ContinueRecipeRecipe` - Write a Continue recipe with Continue.

`CreatePipelineRecipe` - Build a dlt pipeline from scratch for an API of your choice.

`WritePytestsRecipe` - Write Pytest unit tests in a folder adjacent to your Python file.
