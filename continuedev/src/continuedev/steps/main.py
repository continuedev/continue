from typing import Coroutine, List, Union

from pydantic import BaseModel

from ..libs.util.traceback_parsers import parse_python_traceback
from ..libs.llm import LLM
from ..models.main import Traceback, Range
from ..models.filesystem_edit import EditDiff, FileEdit
from ..models.filesystem import RangeInFile, RangeInFileWithContents
from ..core.observation import Observation, TextObservation, TracebackObservation
from ..libs.llm.prompt_utils import MarkdownStyleEncoderDecoder
from textwrap import dedent
from ..core.main import Step
from ..core.sdk import ContinueSDK, Models
from ..core.observation import Observation
import subprocess
from .core.core import EditCodeStep


class RunCodeStep(Step):
    cmd: str

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return f"Ran command: `{self.cmd}`"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        result = subprocess.run(
            self.cmd.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout = result.stdout.decode("utf-8")
        stderr = result.stderr.decode("utf-8")
        print(stdout, stderr)

        # If it fails, return the error
        tb = parse_python_traceback(stdout) or parse_python_traceback(stderr)
        if tb:
            return TracebackObservation(traceback=tb)
        else:
            self.hide = True
            return None


class Policy(BaseModel):
    pass


class RunPolicyUntilDoneStep(Step):
    policy: "Policy"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        next_step = self.policy.next(sdk.history)
        while next_step is not None:
            observation = await sdk.run_step(next_step)
            next_step = self.policy.next(sdk.history)
        return observation


class RunCommandStep(Step):
    cmd: str
    name: str = "Run command"
    _description: str = None

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self._description is not None:
            return self._description
        return self.cmd

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        cwd = await sdk.ide.getWorkspaceDirectory()
        result = subprocess.run(
            self.cmd.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
        stdout = result.stdout.decode("utf-8")
        stderr = result.stderr.decode("utf-8")
        print(stdout, stderr)

        # If it fails, return the error
        if result.returncode != 0:
            return TextObservation(text=stderr)
        else:
            return TextObservation(text=stdout)


class FasterEditHighlightedCodeStep(Step):
    user_input: str
    hide = True
    _completion: str = "Edit Code"
    _edit_diffs: Union[List[EditDiff], None] = None
    _prompt: str = dedent("""\
        You will be given code to edit in order to perfectly satisfy the user request. All the changes you make must be described as replacements, which you should format in the following way:
        FILEPATH
        <FILE_TO_EDIT>
        REPLACE_ME
        <CODE_TO_REPLACE>
        REPLACE_WITH
        <CODE_TO_REPLACE_WITH>

        where <CODE_TO_REPLACE> and <CODE_TO_REPLACE_WITH> can be multiple lines, but should be the mininum needed to make the edit. Be sure to maintain existing whitespace at the start of lines.

        For example, if you want to replace the code `x = 1` with `x = 2` in main.py, you would write:
        FILEPATH
        main.py
        REPLACE_ME
        x = 1
        REPLACE_WITH
        x = 2
        If you wanted to delete the code
        ```
        def sum(a, b):
            return a + b
        ```
        in main.py, you would write:
        FILEPATH
        main.py
        REPLACE_ME
        def sum(a, b):
            return a + b
        REPLACE_WITH

        You may need to make multiple edits; respond with exactly as many as needed.

        Below is the code before changes:

        {code}

        This is the user request: "{user_input}"
        Here is the description of changes to make:
""")

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing highlighted code"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        range_in_files = await sdk.ide.getHighlightedCode()
        if len(range_in_files) == 0:
            # Get the full contents of all open files
            files = await sdk.ide.getOpenFiles()
            contents = {}
            for file in files:
                contents[file] = await sdk.ide.readFile(file)

            range_in_files = [RangeInFile.from_entire_file(
                filepath, content) for filepath, content in contents.items()]

        rif_with_contents = []
        for range_in_file in range_in_files:
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))
        enc_dec = MarkdownStyleEncoderDecoder(rif_with_contents)
        code_string = enc_dec.encode()
        prompt = self._prompt.format(
            code=code_string, user_input=self.user_input)

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        completion = (await sdk.models.gpt35()).complete(prompt)

        # Temporarily doing this to generate description.
        self._prompt = prompt
        self._completion = completion
        print(completion)

        # ALTERNATIVE DECODING STEP HERE
        raw_file_edits = []
        lines = completion.split("\n")
        current_edit = {}
        status = "FILEPATH"
        for i in range(0, len(lines)):
            line = lines[i]
            if line == "FILEPATH":
                if "FILEPATH" in current_edit:
                    raw_file_edits.append(current_edit)
                current_edit = {}
                status = "FILEPATH"
            elif line == "REPLACE_ME":
                status = "REPLACE_ME"
            elif line == "REPLACE_WITH":
                status = "REPLACE_WITH"
            elif status == "FILEPATH":
                current_edit["filepath"] = line
            elif status == "REPLACE_ME":
                if "replace_me" in current_edit:
                    current_edit["replace_me"] += "\n" + line
                else:
                    current_edit["replace_me"] = line
            elif status == "REPLACE_WITH":
                if "replace_with" in current_edit:
                    current_edit["replace_with"] += "\n" + line
                else:
                    current_edit["replace_with"] = line
        if "filepath" in current_edit:
            raw_file_edits.append(current_edit)

        file_edits = []
        for edit in raw_file_edits:
            filepath = edit["filepath"]
            replace_me = edit["replace_me"]
            replace_with = edit["replace_with"]
            file_edits.append(
                FileEdit(filepath=filepath, range=Range.from_lines_snippet_in_file(content=rif_dict[filepath], snippet=replace_me), replacement=replace_with))
        # ------------------------------

        self._edit_diffs = []
        for file_edit in file_edits:
            diff = await sdk.apply_filesystem_edit(file_edit)
            self._edit_diffs.append(diff)

        for filepath in set([file_edit.filepath for file_edit in file_edits]):
            await sdk.ide.saveFile(filepath)
            await sdk.ide.setFileOpen(filepath)

        return None


class StarCoderEditHighlightedCodeStep(Step):
    user_input: str
    name: str = "Editing code"
    hide = False
    _prompt: str = "<commit_before>{code}<commit_msg>{user_request}<commit_after>"

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return (await models.gpt35()).complete(f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        range_in_files = await sdk.ide.getHighlightedCode()
        if len(range_in_files) == 0:
            # Get the full contents of all open files
            files = await sdk.ide.getOpenFiles()
            contents = {}
            for file in files:
                contents[file] = await sdk.ide.readFile(file)

            range_in_files = [RangeInFile.from_entire_file(
                filepath, content) for filepath, content in contents.items()]

        rif_with_contents = []
        for range_in_file in range_in_files:
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        for rif in rif_with_contents:
            prompt = self._prompt.format(
                code=rif.contents, user_request=self.user_input)
            completion = str((await sdk.models.starcoder()).complete(prompt))
            eot_token = "<|endoftext|>"
            if completion.endswith(eot_token):
                completion = completion[:completion.rindex(eot_token)]

            self._prompt_and_completion += prompt + completion

            await sdk.ide.applyFileSystemEdit(
                FileEdit(filepath=rif.filepath, range=rif.range, replacement=completion))
            await sdk.ide.saveFile(rif.filepath)
            await sdk.ide.setFileOpen(rif.filepath)


class EditHighlightedCodeStep(Step):
    user_input: str
    hide = True
    _prompt: str = dedent("""Below is the code before changes:

{code}

This is the user request:

{user_input}

This is the code after being changed to perfectly satisfy the user request:
    """)

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing highlighted code"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        range_in_files = await sdk.ide.getHighlightedCode()
        if len(range_in_files) == 0:
            # Get the full contents of all open files
            files = await sdk.ide.getOpenFiles()
            contents = {}
            for file in files:
                contents[file] = await sdk.ide.readFile(file)

            range_in_files = [RangeInFile.from_entire_file(
                filepath, content) for filepath, content in contents.items()]

        await sdk.run_step(EditCodeStep(
            range_in_files=range_in_files, prompt=self._prompt.format(code="{code}", user_input=self.user_input)))


class FindCodeStep(Step):
    prompt: str

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Finding code"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return await sdk.ide.getOpenFiles()


class UserInputStep(Step):
    user_input: str


class SolveTracebackStep(Step):
    traceback: Traceback

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return f"```\n{self.traceback.full_traceback}\n```"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        prompt = dedent("""I ran into this problem with my Python code:

                {traceback}

                Below are the files that might need to be fixed:

                {code}

                This is what the code should be in order to avoid the problem:
            """).format(traceback=self.traceback.full_traceback, code="{code}")

        range_in_files = []
        for frame in self.traceback.frames:
            content = await sdk.ide.readFile(frame.filepath)
            range_in_files.append(
                RangeInFile.from_entire_file(frame.filepath, content))

        await sdk.run_step(EditCodeStep(
            range_in_files=range_in_files, prompt=prompt))
        return None


class MessageStep(Step):
    name: str = "Message"
    message: str

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.message

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return TextObservation(text=self.message)


class EmptyStep(Step):
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return ""

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        pass
