import asyncio
from typing import List, Optional

from ripgrepy import Ripgrepy

from ...core.main import Step
from ...core.models import Models
from ...core.sdk import ContinueSDK
from ...libs.llm.prompts.edit import codellama_edit_prompt
from ...libs.util.ripgrep import get_rg_path
from ...libs.util.strings import remove_quotes_and_escapes, strip_code_block
from ...libs.util.templating import render_prompt_template
from ...models.filesystem import RangeInFile
from ...models.filesystem_edit import FileEdit
from ...models.main import PositionInFile, Range


class RefactorReferencesStep(Step):
    name: str = "Refactor references of a symbol"
    user_input: str
    symbol_location: PositionInFile

    async def describe(self, models: Models):
        return f"Renamed all instances of `{self.function_name}` to `{self.new_function_name}` in `{self.filepath}`"

    async def run(self, sdk: ContinueSDK):
        references = await sdk.ide.find_references(
            self.symbol_location.filepath, self.symbol_location.position, False
        )
        await sdk.run_step(
            ParallelEditStep(user_input=self.user_input, range_in_files=references)
        )


class RefactorBySearchStep(Step):
    name: str = "Refactor by search"

    pattern: str
    user_input: str

    rg_path: Optional[str] = None
    "Optional path to ripgrep executable"

    def get_range_for_result(self, result) -> RangeInFile:
        pass

    async def run(self, sdk: ContinueSDK):
        rg = Ripgrepy(
            self.pattern,
            sdk.ide.workspace_directory,
            rg_path=self.rg_path or get_rg_path(),
        )

        results = rg.I().context(2).run()
        range_in_files = [self.get_range_for_result(result) for result in results]

        await sdk.run_step(
            ParallelEditStep(user_input=self.user_input, range_in_files=range_in_files)
        )


class ParallelEditStep(Step):
    name: str = "Edit multiple ranges in parallel"
    user_input: str
    range_in_files: List[RangeInFile]

    hide: bool = True

    async def single_edit(
        self, sdk: ContinueSDK, range_in_file: RangeInFile
    ) -> FileEdit:
        # TODO: Can use folding info to get a more intuitively shaped range
        expanded_range = await sdk.ide.get_enclosing_folding_range(range_in_file)
        if (
            expanded_range is None
            or expanded_range.range.start.line != range_in_file.range.start.line
        ):
            expanded_range = Range.from_shorthand(
                range_in_file.range.start.line, 0, range_in_file.range.end.line + 1, 0
            )
        else:
            expanded_range = expanded_range.range

        new_rif = RangeInFile(
            filepath=range_in_file.filepath,
            range=expanded_range,
        )
        code_to_edit = await sdk.ide.readRangeInFile(range_in_file=new_rif)

        # code_to_edit, common_whitespace = dedent_and_get_common_whitespace(code_to_edit)

        prompt = render_prompt_template(
            codellama_edit_prompt,
            history=[],
            other_data={
                "code_to_edit": code_to_edit,
                "user_input": self.user_input,
            },
        )
        print(prompt + "\n\n-------------------\n\n")

        new_code = await sdk.models.edit.complete(prompt=prompt)
        new_code = strip_code_block(remove_quotes_and_escapes(new_code)) + "\n"
        # new_code = (
        #     "\n".join([common_whitespace + line for line in new_code.split("\n")])
        #     + "\n"
        # )

        print(new_code + "\n\n-------------------\n\n")

        return FileEdit(
            filepath=range_in_file.filepath,
            range=expanded_range,
            replacement=new_code,
        )

    async def edit_file(self, sdk: ContinueSDK, filepath: str) -> List[FileEdit]:
        ranges_in_file = [
            range_in_file
            for range_in_file in self.range_in_files
            if range_in_file.filepath == filepath
        ]
        # Sort in reverse order so that we don't mess up the ranges
        ranges_in_file.sort(key=lambda x: x.range.start.line, reverse=True)
        return await asyncio.gather(
            *[
                self.single_edit(
                    sdk=sdk,
                    range_in_file=ranges_in_file[i],
                )
                for i in range(len(ranges_in_file))
            ]
        )

    async def run(self, sdk: ContinueSDK):
        tasks = []
        for filepath in set([rif.filepath for rif in self.range_in_files]):
            tasks.append(self.edit_file(sdk=sdk, filepath=filepath))

        edits_per_file = await asyncio.gather(*tasks)
        all_edits = []
        for edits in edits_per_file:
            all_edits += edits

        await sdk.ide.showMultiFileEdit(edits=all_edits)
