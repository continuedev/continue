from textwrap import dedent
from ...models.filesystem_edit import AddDirectory, AddFile
from ...core.main import Step, ContinueSDK
import os


class WritePytestsRecipe(Step):
    for_filepath: str

    async def run(self, sdk: ContinueSDK):
        filename, dirname = os.path.split(self.for_filepath)

        path_dir = os.path.join(dirname, "tests")
        if not os.path.exists(path_dir):
            await sdk.apply_filesystem_edit(AddDirectory(path=path_dir))

        path = os.path.join(path_dir, f"test_{filename}")
        if os.path.exists(path):
            return

        for_file_contents = await sdk.ide.readFile(self.for_filepath)

        prompt = dedent(f"""\
            This is the file you will write unit tests for:

            ```python
            {for_file_contents}
            ```

            Here are additional instructions:

            "{self.instructions}"

            Here is a complete set of pytest unit tests:
        """)
        tests = (await sdk.models.gpt35()).complete(prompt)
        await sdk.apply_filesystem_edit(AddFile(filepath=path, content=tests))
