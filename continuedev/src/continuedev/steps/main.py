import os
from typing import Coroutine, List, Union

from pydantic import BaseModel, Field

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
from .core.core import DefaultModelEditCodeStep
from ..libs.util.calculate_diff import calculate_diff2


class SetupContinueWorkspaceStep(Step):
    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Set up Continue workspace by adding a .continue directory"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        if not os.path.exists(os.path.join(await sdk.ide.getWorkspaceDirectory(), ".continue")):
            await sdk.add_directory(".continue")
            if not os.path.exists(os.path.join(await sdk.ide.getWorkspaceDirectory(), ".continue", "config.json")):
                await sdk.add_file(".continue/config.json", dedent("""\
                    {
                        "allow_anonymous_telemetry": true
                    }"""))


class Policy(BaseModel):
    pass


class RunPolicyUntilDoneStep(Step):
    policy: "Policy"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        next_step = self.policy.next(sdk.config, sdk.history)
        while next_step is not None:
            observation = await sdk.run_step(next_step)
            next_step = self.policy.next(sdk.config, sdk.history)
        return observation


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

        completion = await sdk.models.gpt35.complete(prompt)

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
    name: str = "Editing Code"
    hide = False
    _prompt: str = "<commit_before>{code}<commit_msg>{user_request}<commit_after>"

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return await models.gpt35.complete(f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        range_in_files = await sdk.ide.getHighlightedCode()
        found_highlighted_code = len(range_in_files) > 0
        if not found_highlighted_code:
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

            if found_highlighted_code:
                full_file_contents = await sdk.ide.readFile(rif.filepath)
                segs = full_file_contents.split(rif.contents)
                prompt = f"<file_prefix>{segs[0]}<file_suffix>{segs[1]}" + prompt

            completion = str(await sdk.models.starcoder.complete(prompt))
            eot_token = "<|endoftext|>"
            completion = completion.removesuffix(eot_token)

            if found_highlighted_code:
                rif.contents = segs[0] + rif.contents + segs[1]
                completion = segs[0] + completion + segs[1]

            self._prompt_and_completion += prompt + completion

            edits = calculate_diff2(
                rif.filepath, rif.contents, completion.removesuffix("\n"))
            for edit in edits:
                await sdk.ide.applyFileSystemEdit(edit)

            # await sdk.ide.applyFileSystemEdit(
            #     FileEdit(filepath=rif.filepath, range=rif.range, replacement=completion))
            await sdk.ide.saveFile(rif.filepath)
            await sdk.ide.setFileOpen(rif.filepath)


class EditHighlightedCodeStep(Step):
    user_input: str = Field(
        ..., title="User Input", description="The natural language request describing how to edit the code")
    hide = True
    description: str = "Change the contents of the currently highlighted code or open file. You should call this function if the user asks seems to be asking for a code change."

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing code"

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

        # If still no highlighted code, create a new file and edit there
        if len(range_in_files) == 0:
            # Create a new file
            new_file_path = "new_file.txt"
            await sdk.add_file(new_file_path)
            range_in_files = [RangeInFile.from_entire_file(new_file_path, "")]

        await sdk.run_step(DefaultModelEditCodeStep(user_input=self.user_input, range_in_files=range_in_files))


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


class EmptyStep(Step):
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return ""

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        pass
