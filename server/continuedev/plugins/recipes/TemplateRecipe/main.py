from typing import Coroutine

from ....core.main import Observation, Step
from ....core.sdk import ContinueSDK, Models


class TemplateRecipe(Step):
    """
    A simple recipe that appends a print statement to the currently open file.
    Use this as a template to create your own!
    """

    # Parameters for the recipe
    name: str

    # A title for the recipe, to be displayed in the GUI
    title = "Template Recipe"

    # A description of what the recipe accomplished, to be displayed in the GUI
    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return f"Appended a statement to print `Hello, {self.name}!` at the end of the file."

    # The code executed when the recipe is run
    async def run(self, sdk: ContinueSDK):
        visible_files = await sdk.ide.getVisibleFiles()
        await sdk.edit_file(
            filename=visible_files[0],
            prompt=f"Append a statement to print `Hello, {self.name}!` at the end of the file.",
        )
