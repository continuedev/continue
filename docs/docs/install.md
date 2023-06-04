# Installation

:::note
If you want to try Continue before installing locally, check out the [GitHub Codespaces Demo](./getting-started.md)
:::

## Install Continue locally in VS Code

1. Click `Install` on the Continue extension in the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Continue.continue)

2. This will open the Continue extension page in VS Code, where you will need to click `Install` again

3. Once you do this, you will see a message in the bottom right hand corner of VS Code that says `Setting up Continue extension...`. After 30-90 seconds, the Continue extension will then open up. It should look like this when it is complete:

**TODO: Add link to screenshot of what it looks like after install has completed**

You can also open the Continue GUI with `cmd+shift+p` on Mac / `ctrl+shift+p` on Windows and then selecting `Continue: Open Debug Panel`

4. To test a few common recipes, open a blank python file and try the following:
- Ask it to "write me a calculator class in python"
- /comment to write comments for the class
- /pytest to write Pytest unit tests in a separate file
- Ask in natural language for a new method

**TODO: Can we have one getting started workflow across VS Code and GitHub Codespaces?**

:::note
If you would like to install Continue from source, please [follow the instructions](https://github.com/continuedev/continue/blob/main/README.md) in the repo README.
:::

## Next steps

Now that you have installed locally in VS Code, you can learn more with our walkthroughs:
- [Use the GUI](./walkthroughs/use-the-gui.md)
- [Use a recipe](./walkthroughs/use-a-recipe.md)
- [Create a recipe](./walkthroughs/create-a-recipe.md)
- [Share a recipe](./walkthroughs/share-a-recipe.md)