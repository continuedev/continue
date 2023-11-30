import os
from textwrap import dedent
from typing import List, Optional, Union

from pydantic import BaseModel, Field

from ...core.main import ContextItem, ContinueCustomException, SetStep, Step
from ...core.sdk import ContinueSDK, Models
from ...core.steps import DefaultModelEditCodeStep
from ...libs.llm.base import LLM
from ...libs.llm.prompt_utils import MarkdownStyleEncoderDecoder
from ...libs.util.calculate_diff import calculate_diff2
from ...libs.util.logging import logger
from ...libs.util.paths import decode_escaped_path, encode_escaped_path
from ...models.filesystem import RangeInFile, RangeInFileWithContents
from ...models.filesystem_edit import EditDiff, FileEdit
from ...models.main import Range, Traceback


class Policy(BaseModel):
    def next(self, config, history) -> Optional[Step]:
        ...


class RunPolicyUntilDoneStep(Step):
    policy: "Policy"

    async def run(self, sdk: ContinueSDK):
        next_step = self.policy.next(sdk.config, sdk.history)

        observation = None
        while next_step is not None:
            observation = await sdk.run_step(next_step)
            next_step = self.policy.next(sdk.config, sdk.history)

        if observation:
            yield observation


class FasterEditHighlightedCodeStep(Step):
    user_input: str
    hide = True
    _completion: str = "Edit Code"
    _edit_diffs: Union[List[EditDiff], None] = None
    _prompt: str = dedent(
        """\
        You will be given code to edit in order to perfectly satisfy the user request. All the changes you make must be described as replacements, which you should format in the following way:
        FILEPATH
        <FILE_TO_EDIT>
        REPLACE_ME
        <CODE_TO_REPLACE>
        REPLACE_WITH
        <CODE_TO_REPLACE_WITH>

        where <CODE_TO_REPLACE> and <CODE_TO_REPLACE_WITH> can be multiple lines, but should be the minimum needed to make the edit. Be sure to maintain existing whitespace at the start of lines.

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
"""
    )

    async def describe(self, models: Models) -> str:
        return "Editing highlighted code"

    async def run(self, sdk: ContinueSDK):
        range_in_files = await sdk.get_code_context(only_editing=True)
        if len(range_in_files) == 0:
            # Get the full contents of all visible files
            files = await sdk.ide.getVisibleFiles()
            contents = {}
            for file in files:
                contents[file] = await sdk.ide.readFile(file)

            range_in_files = [
                RangeInFileWithContents.from_entire_file(filepath, content)
                for filepath, content in contents.items()
            ]

        enc_dec = MarkdownStyleEncoderDecoder(range_in_files)
        code_string = enc_dec.encode()
        prompt = self._prompt.format(code=code_string, user_input=self.user_input)

        rif_dict = {}
        for rif in range_in_files:
            rif_dict[rif.filepath] = rif.contents

        completion = await sdk.models.summarize.complete(prompt)

        # Temporarily doing this to generate description.
        self._prompt = prompt
        self._completion = completion
        logger.debug(completion)

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
                FileEdit(
                    filepath=filepath,
                    range=Range.from_lines_snippet_in_file(
                        content=rif_dict[filepath], snippet=replace_me
                    ),
                    replacement=replace_with,
                )
            )
        # ------------------------------

        self._edit_diffs = []
        for file_edit in file_edits:
            diff = await sdk.apply_filesystem_edit(file_edit)
            self._edit_diffs.append(diff)

        for filepath in set([file_edit.filepath for file_edit in file_edits]):
            await sdk.ide.saveFile(filepath)
            await sdk.ide.setFileOpen(filepath)


class StarCoderEditHighlightedCodeStep(Step):
    user_input: str
    name: str = "Editing Code"
    hide = False
    _prompt: str = "<commit_before>{code}<commit_msg>{user_request}<commit_after>"

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> str:
        return await models.summarize.complete(
            f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points:"
        )

    async def run(self, sdk: ContinueSDK):
        range_in_files = await sdk.get_code_context(only_editing=True)
        found_highlighted_code = len(range_in_files) > 0
        if not found_highlighted_code:
            # Get the full contents of all visible files
            files = await sdk.ide.getVisibleFiles()
            contents = {}
            for file in files:
                contents[file] = await sdk.ide.readFile(file)

            range_in_files = [
                RangeInFileWithContents.from_entire_file(filepath, content)
                for filepath, content in contents.items()
            ]

        rif_dict = {}
        for rif in range_in_files:
            rif_dict[rif.filepath] = rif.contents

        for rif in range_in_files:
            prompt = self._prompt.format(
                code=rif.contents, user_request=self.user_input
            )

            segs = ["", ""]
            if found_highlighted_code:
                full_file_contents = await sdk.ide.readFile(rif.filepath)
                segs = full_file_contents.split(rif.contents)
                prompt = f"<file_prefix>{segs[0]}<file_suffix>{segs[1]}" + prompt

            completion = str(await sdk.models.edit.complete(prompt))
            eot_token = "<|endoftext|>"
            completion = completion.removesuffix(eot_token)

            if found_highlighted_code:
                rif.contents = segs[0] + rif.contents + segs[1]
                completion = segs[0] + completion + segs[1]

            self._prompt_and_completion += prompt + completion

            edits = calculate_diff2(
                rif.filepath, rif.contents, completion.removesuffix("\n")
            )
            for edit in edits:
                await sdk.ide.applyFileSystemEdit(edit)

            # await sdk.ide.applyFileSystemEdit(
            #     FileEdit(filepath=rif.filepath, range=rif.range, replacement=completion))
            await sdk.ide.saveFile(rif.filepath)
            await sdk.ide.setFileOpen(rif.filepath)


class EditAlreadyEditedRangeStep(Step):
    hide = True
    model: Optional[LLM] = None
    range_in_file: RangeInFile

    user_input: str

    _prompt = dedent(
        """\
                    You were previously asked to edit this code. The request was:

                    "{prev_user_input}"
                    
                    And you generated this diff:

                    {diff}
                    
                    Could you please re-edit this code to follow these secondary instructions?

                    "{user_input}"
                    """
    )

    async def run(self, sdk: ContinueSDK):
        if os.path.basename(self.range_in_file.filepath) in os.listdir(
            os.path.expanduser(os.path.join("~", ".continue", "diffs"))
        ):
            decoded_basename = decode_escaped_path(
                os.path.basename(self.range_in_file.filepath)
            )
            self.range_in_file.filepath = decoded_basename

        self.range_in_file.range = sdk.context.get("last_edit_range")

        if self.range_in_file.range.start == self.range_in_file.range.end:
            self.range_in_file.range = Range.from_entire_file(
                await sdk.ide.readFile(self.range_in_file.filepath)
            )

        await sdk.run_step(
            DefaultModelEditCodeStep(
                model=self.model,
                user_input=self._prompt.format(
                    prev_user_input=sdk.context.get("last_edit_user_input"),
                    diff=sdk.context.get("last_edit_diff"),
                    user_input=self.user_input,
                ),
                range_in_files=[self.range_in_file],
            )
        )


class EditHighlightedCodeStep(Step):
    user_input: str = Field(
        ...,
        title="User Input",
        description="The natural language request describing how to edit the code",
    )
    model: Optional[LLM] = None
    hide = True
    description: str = "Change the contents of the currently highlighted code or open file. You should call this function if the user asks seems to be asking for a code change."

    summary_prompt: Optional[str] = None

    async def describe(self, models: Models) -> str:
        return "Editing code"

    async def run(self, sdk: ContinueSDK):
        yield SetStep(description="Editing file...")

        range_in_files = await sdk.get_code_context(only_editing=True)

        # If nothing highlighted, insert at the cursor if possible
        if len(range_in_files) == 0:
            highlighted_code = await sdk.ide.getHighlightedCode()
            if highlighted_code is not None:
                for rif in highlighted_code:
                    if rif.range.start == rif.range.end:
                        range_in_files.append(
                            RangeInFileWithContents.from_range_in_file(rif, "")
                        )

        # If still no highlighted code, raise error
        if len(range_in_files) == 0:
            raise ContinueCustomException(
                message="Please highlight some code and try again.",
                title="No Code Selected (highlight and select with cmd+shift+M)",
            )

        # If all of the ranges are point ranges, only edit the last one
        if all([rif.range.start == rif.range.end for rif in range_in_files]):
            range_in_files = [range_in_files[-1]]

        range_in_files = list(
            map(
                lambda x: RangeInFile(filepath=x.filepath, range=x.range),
                range_in_files,
            )
        )

        for range_in_file in range_in_files:
            # Check whether re-editing
            if (
                os.path.dirname(range_in_file.filepath)
                == os.path.expanduser(os.path.join("~", ".continue", "diffs"))
                or encode_escaped_path(range_in_file.filepath)
                in os.listdir(
                    os.path.expanduser(os.path.join("~", ".continue", "diffs"))
                )
            ) and sdk.context.get("last_edit_user_input") is not None:
                await sdk.run_step(
                    EditAlreadyEditedRangeStep(
                        range_in_file=range_in_file,
                        user_input=self.user_input,
                        model=self.model,
                    )
                )
                return

        args = {
            "user_input": self.user_input,
            "range_in_files": range_in_files,
            "model": self.model,
        }
        if self.summary_prompt:
            args["summary_prompt"] = self.summary_prompt

        await sdk.run_step(DefaultModelEditCodeStep(**args))


class UserInputStep(Step):
    user_input: str
    context_items: List[ContextItem] = []


class SolveTracebackStep(Step):
    traceback: Traceback

    async def describe(self, models: Models) -> str:
        return f"```\n{self.traceback.full_traceback}\n```"

    async def run(self, sdk: ContinueSDK):
        prompt = dedent(
            """I ran into this problem with my Python code:

                {traceback}

                Below are the files that might need to be fixed:

                {code}

                This is what the code should be in order to avoid the problem:
            """
        ).format(traceback=self.traceback.full_traceback, code="{code}")

        range_in_files = []
        for frame in self.traceback.frames:
            content = await sdk.ide.readFile(frame.filepath)
            range_in_files.append(RangeInFile.from_entire_file(frame.filepath, content))

        await sdk.run_step(
            DefaultModelEditCodeStep(range_in_files=range_in_files, user_input=prompt)
        )


class EmptyStep(Step):
    hide: bool = True

    async def describe(self, models: Models) -> str:
        return ""

    async def run(self, sdk: ContinueSDK):
        pass
