from ...core.main import Models, Step
from ...core.sdk import ContinueSDK
from ...models.filesystem_edit import FileEdit, Range


class FindAndReplaceStep(Step):
    name: str = "Find and replace"
    filepath: str
    pattern: str
    replacement: str

    async def describe(self, models: Models):
        return f"Replaced all instances of `{self.pattern}` with `{self.replacement}` in `{self.filepath}`"

    async def run(self, sdk: ContinueSDK):
        file_content = await sdk.ide.readFile(self.filepath)
        while self.pattern in file_content:
            start_index = file_content.index(self.pattern)
            end_index = start_index + len(self.pattern)
            await sdk.ide.applyFileSystemEdit(
                FileEdit(
                    filepath=self.filepath,
                    range=Range.from_indices(file_content, start_index, end_index - 1),
                    replacement=self.replacement,
                )
            )
            file_content = (
                file_content[:start_index] + self.replacement + file_content[end_index:]
            )
            await sdk.ide.saveFile(self.filepath)
