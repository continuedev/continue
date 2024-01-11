import os
from textwrap import dedent
from typing import Union

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....models.filesystem_edit import AddDirectory, AddFile


class WritePytestsRecipe(Step):
    for_filepath: Union[str, None] = None
    user_input: str = "Write unit tests for this file."

    async def describe(self, models):
        return f"Writing unit tests for {self.for_filepath}"

    async def run(self, sdk: ContinueSDK):
        if self.for_filepath is None:
            self.for_filepath = (await sdk.ide.getVisibleFiles())[0]

        filename = os.path.basename(self.for_filepath)
        dirname = os.path.dirname(self.for_filepath)

        path_dir = os.path.join(dirname, "tests")
        if not os.path.exists(path_dir):
            await sdk.apply_filesystem_edit(AddDirectory(path=path_dir))

        path = os.path.join(path_dir, f"test_{filename}")
        if os.path.exists(path):
            return None

        for_file_contents = await sdk.ide.readFile(self.for_filepath)

        prompt = dedent(
            f"""\
            This is the file you will write unit tests for:

            ```python
            {for_file_contents}
            ```

            Here are additional instructions:

            "{self.user_input}"

            Here is a complete set of pytest unit tests:"""
        )
        tests = await sdk.models.summarize.complete(prompt)

        await sdk.apply_filesystem_edit(AddFile(filepath=path, content=tests))

        return None
