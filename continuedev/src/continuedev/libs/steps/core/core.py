# These steps are depended upon by ContinueSDK
from typing import Callable, Coroutine, Dict, Generator, List, Tuple, Union

from ....models.filesystem_edit import EditDiff, FileEditWithFullContents, FileSystemEdit
from ....models.filesystem import FileSystem
from ...llm import LLM
from ...observation import Observation, UserInputObservation
from ...core import Step


class ContinueSDK:
    pass


class SequentialStep(Step):
    steps: list[Step]
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        for step in self.steps:
            observation = await sdk.run_step(step)
        return observation


class ReversibleStep(Step):
    async def reverse(self, sdk: ContinueSDK):
        raise NotImplementedError


class FileSystemEditStep(ReversibleStep):
    edit: FileSystemEdit
    _diff: Union[EditDiff, None] = None

    hide: bool = True

    async def run(self, sdk: "ContinueSDK") -> Coroutine[Observation, None, None]:
        self._diff = await sdk.ide.applyFileSystemEdit(self.edit)
        return None

    async def reverse(self, sdk: "ContinueSDK"):
        await sdk.ide.applyFileSystemEdit(self._diff.backward)
        # Where and when should file saves happen?


class ManualEditStep(ReversibleStep):
    edit_diff: EditDiff
    hide: bool = True

    hide: bool = True

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return "Manual edit step"
        # TODO - only handling FileEdit here, but need all other types of FileSystemEdits
        # Also requires the merge_file_edit function
        # return llm.complete(dedent(f"""This code was replaced:

        #     {self.edit_diff.backward.replacement}

        #     With this code:

        #     {self.edit_diff.forward.replacement}

        #     Maximally concise summary of changes in bullet points (can use markdown):
        # """))

    @classmethod
    def from_sequence(cls, edits: List[FileEditWithFullContents]) -> "ManualEditStep":
        diffs = []
        for edit in edits:
            _, diff = FileSystem.apply_edit_to_str(
                edit.fileContents, edit.fileEdit)
            diffs.append(diff)
        return cls(edit_diff=EditDiff.from_sequence(diffs))

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return None

    async def reverse(self, sdk: ContinueSDK):
        await sdk.ide.applyFileSystemEdit(self.edit_diff.backward)


class UserInputStep(Step):
    user_input: str
    name: str = "User Input"
    hide: bool = True

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return self.user_input

    async def run(self, sdk: ContinueSDK) -> Coroutine[UserInputObservation, None, None]:
        return UserInputObservation(user_input=self.user_input)
