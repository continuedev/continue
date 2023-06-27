# These steps are depended upon by ContinueSDK
import os
import subprocess
from textwrap import dedent
from typing import Coroutine, List, Literal, Union

from ...models.main import Range
from ...libs.llm.prompt_utils import MarkdownStyleEncoderDecoder
from ...models.filesystem_edit import EditDiff, FileEdit, FileEditWithFullContents, FileSystemEdit
from ...models.filesystem import FileSystem, RangeInFile, RangeInFileWithContents
from ...core.observation import Observation, TextObservation, TracebackObservation, UserInputObservation
from ...core.main import Step, SequentialStep
from ...libs.llm.openai import MAX_TOKENS_FOR_MODEL
import difflib


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
        return await models.gpt35.complete(f"{cmds_str}\n\nSummarize what was done in these shell commands, using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        cwd = await sdk.ide.getWorkspaceDirectory() if self.cwd is None else self.cwd

        for cmd in self.cmds:
            output = await sdk.ide.runCommand(cmd)
            if self.handle_error and output is not None and output_contains_error(output):
                suggestion = await sdk.models.gpt35.complete(dedent(f"""\
                    While running the command `{cmd}`, the following error occurred:

                    ```ascii
                    {output}
                    ```

                    This is a brief summary of the error followed by a suggestion on how it can be fixed:"""), with_history=await sdk.get_chat_context())

                sdk.raise_exception(
                    title="Error while running query", message=output, with_step=MessageStep(name=f"Suggestion to solve error {AI_ASSISTED_STRING}", message=f"{suggestion}\n\nYou can click the retry button on the failed step to try again.")
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


class DefaultModelEditCodeStep(Step):
    user_input: str
    range_in_files: List[RangeInFile]
    name: str = "Editing Code"
    hide = False
    _prompt: str = dedent("""\
        Take the file prefix and suffix into account, but only rewrite the code_to_edit as specified in the user_request. The code you write in modified_code_to_edit will replace the code between the code_to_edit tags. Do NOT preface your answer or write anything other than code. The </modified_code_to_edit> tag should be written to indicate the end of the modified code section. Do not ever use nested tags.

        Example:

        <file_prefix>
        class Database:
            def __init__(self):
                self._data = {{}}
            
            def get(self, key):
                return self._data[key]

        </file_prefix>
        <code_to_edit>
            def set(self, key, value):
                self._data[key] = value
        </code_to_edit>
        <file_suffix>

            def clear_all():
                self._data = {{}}
        </file_suffix>
        <user_request>
        Raise an error if the key already exists.
        </user_request>
        <modified_code_to_edit>
            def set(self, key, value):
                if key in self._data:
                    raise KeyError(f"Key {{key}} already exists")
                self._data[key] = value
        </modified_code_to_edit>

        Main task:
        """)

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        description = await models.gpt35.complete(
            f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points. Be concise and only mention changes made to the commit before, not prefix or suffix:")
        self.name = await models.gpt35.complete(f"Write a very short title to describe this requested change: '{self.user_input}'. This is the title:")
        return f"`{self.user_input}`\n\n" + description

    async def get_prompt_parts(self, rif: RangeInFileWithContents, sdk: ContinueSDK, full_file_contents: str):
        # If using 3.5 and overflows, upgrade to 3.5.16k
        model_to_use = sdk.models.default
        if model_to_use.name == "gpt-3.5-turbo":
            if sdk.models.gpt35.count_tokens(full_file_contents) > MAX_TOKENS_FOR_MODEL["gpt-3.5-turbo"]:
                model_to_use = sdk.models.gpt3516k

        # Remove tokens from the end first, and then the start to clear space
        # This part finds the start and end lines
        full_file_contents_lst = full_file_contents.split("\n")
        max_start_line = rif.range.start.line
        min_end_line = rif.range.end.line
        cur_start_line = 0
        cur_end_line = len(full_file_contents_lst) - 1

        total_tokens = model_to_use.count_tokens(
            full_file_contents + self._prompt)

        if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
            while cur_end_line > min_end_line:
                total_tokens -= model_to_use.count_tokens(
                    full_file_contents_lst[cur_end_line])
                cur_end_line -= 1
                if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                    return cur_start_line, cur_end_line

            if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                while cur_start_line < max_start_line:
                    cur_start_line += 1
                    total_tokens -= model_to_use.count_tokens(
                        full_file_contents_lst[cur_end_line])
                    if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                        return cur_start_line, cur_end_line

        # Now use the found start/end lines to get the prefix and suffix strings
        file_prefix = "\n".join(
            full_file_contents_lst[cur_start_line:max_start_line])
        file_suffix = "\n".join(
            full_file_contents_lst[min_end_line:cur_end_line - 1])

        # Move any surrounding blank line in rif.contents to the prefix/suffix
        # TODO: Keep track of start line of the range, because it's needed below for offset stuff
        rif_start_line = rif.range.start.line
        if len(rif.contents) > 0:
            first_line = rif.contents.splitlines(keepends=True)[0]
            while first_line.strip() == "":
                file_prefix += first_line
                rif.contents = rif.contents[len(first_line):]
                first_line = rif.contents.splitlines(keepends=True)[0]

            last_line = rif.contents.splitlines(keepends=True)[-1]
            while last_line.strip() == "":
                file_suffix = last_line + file_suffix
                rif.contents = rif.contents[:len(
                    rif.contents) - len(last_line)]
                last_line = rif.contents.splitlines(keepends=True)[-1]

            while rif.contents.startswith("\n"):
                file_prefix += "\n"
                rif.contents = rif.contents[1:]
            while rif.contents.endswith("\n"):
                file_suffix = "\n" + file_suffix
                rif.contents = rif.contents[:-1]

        return file_prefix, rif.contents, file_suffix, model_to_use

    def compile_prompt(self, file_prefix: str, contents: str, file_suffix: str, sdk: ContinueSDK) -> str:
        prompt = self._prompt
        if file_prefix.strip() != "":
            prompt += dedent(f"""
<file_prefix>
{file_prefix}
</file_prefix>""")
        prompt += dedent(f"""
<code_to_edit>
{contents}
</code_to_edit>""")
        if file_suffix.strip() != "":
            prompt += dedent(f"""
<file_suffix>
{file_suffix}
</file_suffix>""")
        prompt += dedent(f"""
<user_request>
{self.user_input}
</user_request>
<modified_code_to_edit>
""")

        return prompt

    def is_end_line(self, line: str) -> bool:
        return "</modified_code_to_edit>" in line

    def line_to_be_ignored(self, line: str) -> bool:
        return "```" in line or "<modified_code_to_edit>" in line or "<file_prefix>" in line or "</file_prefix>" in line or "<file_suffix>" in line or "</file_suffix>" in line or "<user_request>" in line or "</user_request>" in line or "<code_to_edit>" in line or "</code_to_edit>" in line

    async def stream_rif(self, rif: RangeInFileWithContents, sdk: ContinueSDK):
        full_file_contents = await sdk.ide.readFile(rif.filepath)

        file_prefix, contents, file_suffix, model_to_use = await self.get_prompt_parts(
            rif, sdk, full_file_contents)
        prompt = self.compile_prompt(file_prefix, contents, file_suffix, sdk)

        full_file_contents_lines = full_file_contents.split("\n")
        original_lines = rif.contents.split("\n")
        completion_lines_covered = 0
        # In the actual file, as it is with blocks and such
        current_line_in_file = rif.range.start.line

        current_block_lines = []
        original_lines_below_previous_blocks = original_lines
        current_block_start = -1
        offset_from_blocks = 0

        lines_of_prefix_copied = 0
        repeating_file_suffix = False
        line_below_highlighted_range = file_suffix.lstrip().split("\n")[0]
        lines = []
        unfinished_line = ""

        async def handle_generated_line(line: str):
            nonlocal lines, current_block_start, current_line_in_file, original_lines, original_lines_below_previous_blocks, current_block_lines, offset_from_blocks

            # Highlight the line to show progress
            await sdk.ide.highlightCode(RangeInFile(filepath=rif.filepath, range=Range.from_shorthand(
                current_line_in_file, 0, current_line_in_file, 0)), "#FFFFFF22" if len(current_block_lines) == 0 else "#FFFF0022")

            if len(current_block_lines) == 0:
                if len(original_lines_below_previous_blocks) == 0 or line != original_lines_below_previous_blocks[0]:
                    current_block_lines.append(line)
                    current_block_start = current_line_in_file

                else:
                    original_lines_below_previous_blocks = original_lines_below_previous_blocks[
                        1:]
                return

            # We are in a block currently, and checking for whether it should be ended
            for i in range(len(original_lines_below_previous_blocks)):
                og_line = original_lines_below_previous_blocks[i]
                if og_line == line and len(og_line.strip()):
                    # Gather the lines to insert/replace for the suggestion
                    lines_to_replace = current_block_lines[:i]
                    original_lines_below_previous_blocks = original_lines_below_previous_blocks[
                        i + 1:]

                    # Insert the suggestion
                    await sdk.ide.showSuggestion(FileEdit(
                        filepath=rif.filepath,
                        range=Range.from_shorthand(
                            current_block_start, 0, current_block_start + i, 0),
                        replacement="\n".join(current_block_lines)
                    ))

                    # Reset current block
                    offset_from_blocks += len(current_block_lines)
                    current_block_lines = []
                    current_block_start = -1
                    return

            current_block_lines.append(line)

        async for chunk in model_to_use.stream_chat(prompt, with_history=await sdk.get_chat_context(), temperature=0):
            # Stop early if it is repeating the file_suffix or the step was deleted
            if repeating_file_suffix:
                break
            if sdk.current_step_was_deleted():
                return

            # Accumulate lines
            chunk_lines = chunk.split("\n")
            chunk_lines[0] = unfinished_line + chunk_lines[0]
            if chunk.endswith("\n"):
                unfinished_line = ""
                chunk_lines.pop()  # because this will be an empty string
            else:
                unfinished_line = chunk_lines.pop()
            lines.extend(chunk_lines)

            # Deal with newly accumulated lines
            for line in chunk_lines:
                # Lines that should signify the end of generation
                if self.is_end_line(line):
                    break
                # Lines that should be ignored, like the <> tags
                elif self.line_to_be_ignored(line):
                    continue
                # Check if we are currently just copying the prefix
                elif (lines_of_prefix_copied > 0 or completion_lines_covered == 0) and lines_of_prefix_copied < len(file_prefix.splitlines()) and line == full_file_contents_lines[lines_of_prefix_copied]:
                    # This is a sketchy way of stopping it from repeating the file_prefix. Is a bug if output happens to have a matching line
                    lines_of_prefix_copied += 1
                    continue
                # Because really short lines might be expected to be repeated, this is only a !heuristic!
                # Stop when it starts copying the file_suffix
                elif line.strip() == line_below_highlighted_range.strip() and len(line.strip()) > 4:
                    repeating_file_suffix = True
                    break

                # If none of the above, insert the line!
                await handle_generated_line(line)
                completion_lines_covered += 1
                current_line_in_file += 1

        # Add the unfinished line
        if unfinished_line != "" and not self.line_to_be_ignored(unfinished_line) and not self.is_end_line(unfinished_line):
            lines.append(unfinished_line)
            await handle_generated_line(unfinished_line)
            completion_lines_covered += 1

        # If the current block isn't empty, add that suggestion
        if len(current_block_lines) > 0:
            await sdk.ide.showSuggestion(FileEdit(
                filepath=rif.filepath,
                range=Range.from_shorthand(
                    current_block_start, 0, current_block_start + len(original_lines_below_previous_blocks), 0),
                replacement="\n".join(current_block_lines)
            ))

        # Record the completion
        completion = "\n".join(lines)
        self._prompt_and_completion += prompt + completion

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = f"`{self.user_input}`"
        await sdk.update_ui()

        rif_with_contents = []
        for range_in_file in map(lambda x: RangeInFile(
            filepath=x.filepath,
            # Only consider the range line-by-line. Maybe later don't if it's only a single line.
            range=x.range.to_full_lines()
        ), self.range_in_files):
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        for rif in rif_with_contents:
            await sdk.ide.setFileOpen(rif.filepath)
            await self.stream_rif(rif, sdk)
            # await sdk.ide.saveFile(rif.filepath)


class EditFileStep(Step):
    filepath: str
    prompt: str
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing file: " + self.filepath

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        file_contents = await sdk.ide.readFile(self.filepath)
        await sdk.run_step(DefaultModelEditCodeStep(
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
