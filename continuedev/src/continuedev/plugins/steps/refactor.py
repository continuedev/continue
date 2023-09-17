import asyncio
from typing import List

from ...core.main import Step
from ...core.models import Models
from ...core.sdk import ContinueSDK
from ...libs.llm.prompts.edit import simplest_edit_prompt
from ...models.filesystem import RangeInFile
from ...models.filesystem_edit import FileEdit
from ...models.main import PositionInFile


class RefactorReferencesStep(Step):
    name: str = "Refactor references of a symbol"
    user_input: str
    symbol_location: PositionInFile

    async def describe(self, models: Models):
        return f"Renamed all instances of `{self.function_name}` to `{self.new_function_name}` in `{self.filepath}`"

    async def run(self, sdk: ContinueSDK):
        while sdk.lsp is None or not sdk.lsp.ready:
            await asyncio.sleep(0.1)

        references = await sdk.lsp.find_references(
            self.symbol_location.position, self.symbol_location.filepath, False
        )
        await sdk.run_step(
            ParallelEditStep(user_input=self.user_input, range_in_files=references)
        )


class ParallelEditStep(Step):
    name: str = "Edit multiple ranges in parallel"
    user_input: str
    range_in_files: List[RangeInFile]

    hide: bool = True

    async def single_edit(self, sdk: ContinueSDK, range_in_file: RangeInFile):
        code_to_edit = await sdk.ide.readRangeInFile(range_in_file=range_in_file)
        prompt = simplest_edit_prompt.format(
            code_to_edit=code_to_edit, user_input=self.user_input
        )
        new_code = await sdk.models.edit.complete(prompt=prompt)

        await sdk.ide.applyFileSystemEdit(
            FileEdit(
                filepath=range_in_file.filepath,
                range=range_in_file.range,
                replacement=new_code,
            )
        )

    async def edit_file(self, sdk: ContinueSDK, filepath: str):
        ranges_in_file = [
            range_in_file
            for range_in_file in self.range_in_files
            if range_in_file.filepath == filepath
        ]
        for rif in ranges_in_file:
            await self.single_edit(sdk=sdk, range_in_file=rif)

    async def run(self, sdk: ContinueSDK):
        tasks = []
        for filepath in set([rif.filepath for rif in self.range_in_files]):
            tasks.append(self.edit_file(sdk=sdk, filepath=filepath))

        await asyncio.gather(*tasks)
