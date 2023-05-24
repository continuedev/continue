import time
from typing import Callable, Coroutine, List, Union

from ..llm import LLM
from ...models.main import Traceback, Range
from ...models.filesystem_edit import EditDiff, FileEdit
from ...models.filesystem import RangeInFile, RangeInFileWithContents
from ..observation import Observation, TextObservation
from ..llm.prompt_utils import MarkdownStyleEncoderDecoder
from textwrap import dedent
from ..core import History, Policy, Step, ContinueSDK, Observation
import subprocess
from ..util.traceback_parsers import parse_python_traceback
from ..observation import TracebackObservation
import json


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

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
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


class WaitForUserInputStep(Step):
    prompt: str
    name: str = "Waiting for user input"

    _description: Union[str, None] = None

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return self.prompt

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self._description = self.prompt
        resp = await sdk.wait_for_user_input()
        return TextObservation(text=resp)


class WaitForUserConfirmationStep(Step):
    prompt: str
    name: str = "Waiting for user confirmation"

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return self.prompt

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self._description = self.prompt
        resp = await sdk.wait_for_user_input()
        return TextObservation(text=resp)


class RunCodeStep(Step):
    cmd: str

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
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


class EditCodeStep(Step):
    # Might make an even more specific atomic step, which is "apply file edit"
    range_in_files: List[RangeInFile]
    prompt: str  # String with {code} somewhere
    name: str = "Edit code"

    _edit_diffs: Union[List[EditDiff], None] = None
    _prompt: Union[str, None] = None
    _completion: Union[str, None] = None

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        if self._edit_diffs is None:
            return "Editing files: " + ", ".join(map(lambda rif: rif.filepath, self.range_in_files))
        elif len(self._edit_diffs) == 0:
            return "No edits made"
        else:
            return llm.complete(dedent(f"""{self._prompt}{self._completion}

                Maximally concise summary of changes in bullet points (can use markdown):
            """))

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        rif_with_contents = []
        for range_in_file in self.range_in_files:
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))
        enc_dec = MarkdownStyleEncoderDecoder(rif_with_contents)
        code_string = enc_dec.encode()
        prompt = self.prompt.format(code=code_string)

        completion = sdk.llm.complete(prompt)

        # Temporarily doing this to generate description.
        self._prompt = prompt
        self._completion = completion

        file_edits = enc_dec.decode(completion)

        self._edit_diffs = []
        for file_edit in file_edits:
            diff = await sdk.apply_filesystem_edit(file_edit)
            self._edit_diffs.append(diff)

        for filepath in set([file_edit.filepath for file_edit in file_edits]):
            await sdk.ide.saveFile(filepath)
            await sdk.ide.setFileOpen(filepath)

        return None


class EditFileStep(Step):
    filepath: str
    prompt: str
    hide: bool = True

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return "Editing file: " + self.filepath

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        file_contents = await sdk.ide.readFile(self.filepath)
        await sdk.run_step(EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(
                self.filepath, file_contents)],
            prompt=self.prompt
        ))


class FasterEditHighlightedCodeStep(Step):
    user_input: str
    hide = True
    _completion: str = "Edit Code"
    _edit_diffs: Union[List[EditDiff], None] = None
    _prompt: str = dedent("""Below is the code before changes:

{code}

This is the user request:

{user_input}

Edit the code to perfectly satifsfy the user request. Format the changes you want to make as a comma-separated array of JSON objects of the form:
{{
    "edits": [{{
        "filepath": <FILEPATH>,
        "replace_me": <CODE_TO_REPLACE>,
        "replace_with": <CODE_TO_REPLACE_WITH>
    }}]
}}

For example, if you want to replace the code `x = 1` with `x = 2` in main.py, you would write:
{{
    "edits": [{{
        "filepath": "main.py",
        "replace_me": "x = 1",
        "replace_with": "x = 2"
    }}]
}}
If you wanted to delete the code `def sum(a, b):\\n    return a + b` in main.py, you would write:
{{
    "edits": [{{
        "filepath": "main.py",
        "replace_me": "def sum(a, b):\\n    return a + b",
        "replace_with": ""
    }}]
}}

Respond with only as many edits as needed, and output only the list of json objects, no other text.
""")

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
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

        completion = sdk.llm.complete(prompt)

        # Temporarily doing this to generate description.
        self._prompt = prompt
        self._completion = completion

        # ALTERNATIVE DECODING STEP HERE
        file_edits = []
        obj = json.loads(completion.strip())
        for edit in obj["edits"]:
            filepath = edit["filepath"]
            replace_me = edit["replace_me"]
            replace_with = edit["replace_with"]
            file_edits.append(
                FileEdit(filepath=filepath, range=Range.from_snippet_in_file(content=rif_dict[filepath], snippet=replace_me), replacement=replace_with))
        # ------------------------------

        self._edit_diffs = []
        for file_edit in file_edits:
            diff = await sdk.apply_filesystem_edit(file_edit)
            self._edit_diffs.append(diff)

        for filepath in set([file_edit.filepath for file_edit in file_edits]):
            await sdk.ide.saveFile(filepath)
            await sdk.ide.setFileOpen(filepath)

        return None


class EditHighlightedCodeStep(Step):
    user_input: str
    hide = True
    _prompt: str = dedent("""Below is the code before changes:

{code}

This is the user request:

{user_input}

This is the code after being changed to perfectly satisfy the user request:
    """)

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
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

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
        return "Finding code"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return await sdk.ide.getOpenFiles()


class UserInputStep(Step):
    user_input: str


class SolveTracebackStep(Step):
    traceback: Traceback

    async def describe(self, llm: LLM) -> Coroutine[str, None, None]:
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
