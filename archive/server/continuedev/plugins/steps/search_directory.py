import asyncio
import os
import re
from textwrap import dedent
from typing import List, Union

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...libs.util.create_async_task import create_async_task
from ...models.filesystem import RangeInFile
from ...models.main import Range

# Already have some code for this somewhere
IGNORE_DIRS = ["env", "venv", ".venv"]
IGNORE_FILES = [".env"]


def find_all_matches_in_dir(pattern: str, dirpath: str) -> List[RangeInFile]:
    range_in_files = []
    for root, dirs, files in os.walk(dirpath):
        dirname = os.path.basename(root)
        if dirname.startswith(".") or dirname in IGNORE_DIRS:
            continue  # continue!
        for file in files:
            if file in IGNORE_FILES:
                continue  # pun intended
            with open(os.path.join(root, file), "r") as f:
                # Find the index of all occurrences of the pattern in the file. Use re.
                file_content = f.read()
                results = re.finditer(pattern, file_content)
                range_in_files += [
                    RangeInFile(
                        filepath=os.path.join(root, file),
                        range=Range.from_indices(
                            file_content, result.start(), result.end()
                        ),
                    )
                    for result in results
                ]

    return range_in_files


class WriteRegexPatternStep(Step):
    user_request: str

    async def run(self, sdk: ContinueSDK):
        # Ask the user for a regex pattern
        pattern = await sdk.models.summarize.complete(
            dedent(
                f"""\
            This is the user request:

            {self.user_request}

            Please write either a regex pattern or just a string that be used with python's re module to find all matches requested by the user. It will be used as `re.findall(<PATTERN_YOU_WILL_WRITE>, file_content)`. Your output should be only the regex or string, nothing else:"""
            )
        )

        return pattern


class EditAllMatchesStep(Step):
    pattern: str
    user_request: str
    directory: Union[str, None] = None

    async def run(self, sdk: ContinueSDK):
        # Search all files for a given string
        range_in_files = find_all_matches_in_dir(
            self.pattern, self.directory or sdk.ide.workspace_directory
        )

        tasks = [
            create_async_task(
                sdk.edit_file(
                    range=range_in_file.range,
                    filename=range_in_file.filepath,
                    prompt=self.user_request,
                )
            )
            for range_in_file in range_in_files
        ]
        await asyncio.gather(*tasks)
