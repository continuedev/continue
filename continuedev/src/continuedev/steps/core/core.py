# These steps are depended upon by ContinueSDK
import os
import subprocess
from textwrap import dedent
from typing import Coroutine, List, Union
from ...libs.llm.prompt_utils import MarkdownStyleEncoderDecoder

from ...models.filesystem_edit import EditDiff, FileEdit, FileEditWithFullContents, FileSystemEdit
from ...models.filesystem import FileSystem, RangeInFile, RangeInFileWithContents
from ...core.observation import Observation, TextObservation, TracebackObservation, UserInputObservation
from ...core.main import Step, SequentialStep


class ContinueSDK:
    pass


class Models:
    pass


class ReversibleStep(Step):
    async def reverse(self, sdk: ContinueSDK):
        raise NotImplementedError


class MessageStep(Step):
    name: str = "Message"
    message: str

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.message

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return TextObservation(text=self.message)


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


def output_contains_error(output: str) -> bool:
    return "Traceback" in output or "SyntaxError" in output


AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class ShellCommandsStep(Step):
    cmds: List[str]
    cwd: Union[str, None] = None
    name: str = "Run Shell Commands"
    handle_error: bool = True

    _err_text: Union[str, None] = None

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self._err_text is not None:
            return f"Error when running shell commands:\n```\n{self._err_text}\n```"

        cmds_str = "\n".join(self.cmds)
        return models.gpt35.complete(f"{cmds_str}\n\nSummarize what was done in these shell commands, using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        cwd = await sdk.ide.getWorkspaceDirectory() if self.cwd is None else self.cwd

        for cmd in self.cmds:
            output = await sdk.ide.runCommand(cmd)
            if self.handle_error and output is not None and output_contains_error(output):
                suggestion = sdk.models.gpt35.complete(dedent(f"""\
                    While running the command `{cmd}`, the following error occurred:

                    ```ascii
                    {output}
                    ```

                    This is a brief summary of the error followed by a suggestion on how it can be fixed:"""), with_history=sdk.chat_context)

                sdk.raise_exception(
                    title="Error while running query", message=output, with_step=MessageStep(name=f"Suggestion to solve error {AI_ASSISTED_STRING}", message=suggestion)
                )

        return TextObservation(text=output)

        # process = subprocess.Popen(
        #     '/bin/bash', stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=cwd)

        # stdin_input = "\n".join(self.cmds)
        # out, err = process.communicate(stdin_input.encode())

        # # If it fails, return the error
        # if err is not None and err != "":
        #     self._err_text = err
        #     return TextObservation(text=err)

        # return None


class Gpt35EditCodeStep(Step):
    user_input: str
    range_in_files: List[RangeInFile]
    name: str = "Editing Code"
    hide = False
    _prompt: str = dedent("""\
        Take the file prefix and suffix into account, but only rewrite the commit before as specified in the commit message. Here's an example:

        <file_prefix>
        a = 5
        b = 4

        <file_suffix>

        def mul(a, b):
            return a * b
        <commit_before>
        def sum():
            return a + b
        <commit_msg>
        Make a and b parameters of sum
        <commit_after>
        def sum(a, b):
            return a + b
        <|endoftext|>

        Now complete the real thing. Do NOT rewrite the prefix or suffix.

        <file_prefix>
        {file_prefix}
        <file_suffix>
        {file_suffix}
        <commit_before>
        {code}
        <commit_msg>
        {user_request}
        <commit_after>
        """)

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return models.gpt35.complete(f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        rif_with_contents = []
        for range_in_file in self.range_in_files:
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        for rif in rif_with_contents:
            full_file_contents = await sdk.ide.readFile(rif.filepath)
            segs = full_file_contents.split(rif.contents)
            prompt = self._prompt.format(
                code=rif.contents, user_request=self.user_input, file_prefix=segs[0], file_suffix=segs[1])

            completion = str(sdk.models.gpt35.complete(prompt))
            eot_token = "<|endoftext|>"
            completion = completion.removesuffix(eot_token)

            self._prompt_and_completion += prompt + completion

            await sdk.ide.applyFileSystemEdit(
                FileEdit(filepath=rif.filepath, range=rif.range, replacement=completion))
            await sdk.ide.saveFile(rif.filepath)
            await sdk.ide.setFileOpen(rif.filepath)


class EditFileStep(Step):
    filepath: str
    prompt: str
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing file: " + self.filepath

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        file_contents = await sdk.ide.readFile(self.filepath)
        await sdk.run_step(Gpt35EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(
                self.filepath, file_contents)],
            user_input=self.prompt
        ))


class ManualEditStep(ReversibleStep):
    edit_diff: EditDiff
    hide: bool = True

    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
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

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.user_input

    async def run(self, sdk: ContinueSDK) -> Coroutine[UserInputObservation, None, None]:
        return UserInputObservation(user_input=self.user_input)


class WaitForUserInputStep(Step):
    prompt: str
    name: str = "Waiting for user input"

    _description: Union[str, None] = None
    _response: Union[str, None] = None

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self._response is None:
            return self.prompt
        else:
            return f"{self.prompt}\n\n`{self._response}`"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = self.prompt
        resp = await sdk.wait_for_user_input()
        self.description = f"{self.prompt}\n\n`{resp}`"
        return TextObservation(text=resp)


class WaitForUserConfirmationStep(Step):
    prompt: str
    name: str = "Waiting for user confirmation"

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.prompt

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = self.prompt
        resp = await sdk.wait_for_user_input()
        return TextObservation(text=resp)
