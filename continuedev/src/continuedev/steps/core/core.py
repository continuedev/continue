# These steps are depended upon by ContinueSDK
import os
import subprocess
from textwrap import dedent
from typing import Coroutine, List, Union

from ...models.main import Range
from ...libs.llm.prompt_utils import MarkdownStyleEncoderDecoder
from ...models.filesystem_edit import EditDiff, FileEdit, FileEditWithFullContents, FileSystemEdit
from ...models.filesystem import FileSystem, RangeInFile, RangeInFileWithContents
from ...core.observation import Observation, TextObservation, TracebackObservation, UserInputObservation
from ...core.main import Step, SequentialStep
from ...libs.util.count_tokens import MAX_TOKENS_FOR_MODEL
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

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = f"{self.user_input}"
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

            model_to_use = sdk.models.default

            full_file_contents = await sdk.ide.readFile(rif.filepath)

            full_file_contents_lst = full_file_contents.split("\n")

            max_start_line = rif.range.start.line
            min_end_line = rif.range.end.line
            cur_start_line = 0
            cur_end_line = len(full_file_contents_lst) - 1

            def cut_context(model_to_use, total_tokens, cur_start_line, cur_end_line):

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

                return cur_start_line, cur_end_line

            model_to_use = sdk.models.default
            if model_to_use.name == "gpt-3.5-turbo":
                if sdk.models.gpt35.count_tokens(full_file_contents) > MAX_TOKENS_FOR_MODEL["gpt-3.5-turbo"]:
                    model_to_use = sdk.models.gpt3516k

            total_tokens = model_to_use.count_tokens(
                full_file_contents + self._prompt + self.user_input)

            cur_start_line, cur_end_line = cut_context(
                model_to_use, total_tokens, cur_start_line, cur_end_line)

            code_before = "\n".join(
                full_file_contents_lst[cur_start_line:max_start_line])
            code_after = "\n".join(
                full_file_contents_lst[min_end_line:cur_end_line - 1])

            segs = [code_before, code_after]
            if segs[0].strip() == "":
                segs[0] = segs[0].strip()
            if segs[1].strip() == "":
                segs[1] = segs[1].strip()

            # Move any surrounding blank line in rif.contents to the prefix/suffix
            if len(rif.contents) > 0:
                first_line = rif.contents.splitlines(keepends=True)[0]
                while first_line.strip() == "":
                    segs[0] += first_line
                    rif.contents = rif.contents[len(first_line):]
                    first_line = rif.contents.splitlines(keepends=True)[0]

                last_line = rif.contents.splitlines(keepends=True)[-1]
                while last_line.strip() == "":
                    segs[1] = last_line + segs[1]
                    rif.contents = rif.contents[:len(
                        rif.contents) - len(last_line)]
                    last_line = rif.contents.splitlines(keepends=True)[-1]

                while rif.contents.startswith("\n"):
                    segs[0] += "\n"
                    rif.contents = rif.contents[1:]
                while rif.contents.endswith("\n"):
                    segs[1] = "\n" + segs[1]
                    rif.contents = rif.contents[:-1]

            # .format(code=rif.contents, user_request=self.user_input, file_prefix=segs[0], file_suffix=segs[1])
            prompt = self._prompt
            if segs[0].strip() != "":
                prompt += dedent(f"""
<file_prefix>
{segs[0]}
</file_prefix>""")
            prompt += dedent(f"""
<code_to_edit>
{rif.contents}
</code_to_edit>""")
            if segs[1].strip() != "":
                prompt += dedent(f"""
<file_suffix>
{segs[1]}
</file_suffix>""")
            prompt += dedent(f"""
<user_request>
{self.user_input}
</user_request>
<modified_code_to_edit>
""")

            lines = []
            unfinished_line = ""
            i = 0
            original_lines = rif.contents.split("\n")

            async def add_line(i: int, line: str):
                if i == 0:
                    # First line indentation, because the model will assume that it is replacing in this way
                    line = original_lines[0].replace(
                        original_lines[0].strip(), "") + line

                if i < len(original_lines):
                    # Replace original line
                    range = Range.from_shorthand(
                        rif.range.start.line + i, rif.range.start.character if i == 0 else 0, rif.range.start.line + i + 1, 0)
                else:
                    # Insert a line
                    range = Range.from_shorthand(
                        rif.range.start.line + i, 0, rif.range.start.line + i, 0)

                await sdk.ide.applyFileSystemEdit(FileEdit(
                    filepath=rif.filepath,
                    range=range,
                    replacement=line + "\n"
                ))

            lines_of_prefix_copied = 0
            line_below_highlighted_range = segs[1].lstrip().split("\n")[0]
            should_stop = False
            async for chunk in model_to_use.stream_complete(prompt, with_history=await sdk.get_chat_context(), temperature=0):
                if should_stop:
                    break
                chunk_lines = chunk.split("\n")
                chunk_lines[0] = unfinished_line + chunk_lines[0]
                if chunk.endswith("\n"):
                    unfinished_line = ""
                    chunk_lines.pop()  # because this will be an empty string
                else:
                    unfinished_line = chunk_lines.pop()
                lines.extend(chunk_lines)

                for line in chunk_lines:
                    if "</modified_code_to_edit>" in line:
                        break
                    elif "```" in line or "<modified_code_to_edit>" in line or "<file_prefix>" in line or "</file_prefix>" in line or "<file_suffix>" in line or "</file_suffix>" in line or "<user_request>" in line or "</user_request>" in line or "<code_to_edit>" in line or "</code_to_edit>" in line:
                        continue
                    elif (lines_of_prefix_copied > 0 or i == 0) and lines_of_prefix_copied < len(segs[0].splitlines()) and line == full_file_contents_lst[lines_of_prefix_copied]:
                        # This is a sketchy way of stopping it from repeating the file_prefix. Is a bug if output happens to have a matching line
                        lines_of_prefix_copied += 1
                        continue
                    elif i < len(original_lines) and line == original_lines[i]:
                        i += 1
                        continue
                    # Because really short lines might be expected to be repeated !heuristic!
                    elif line.strip() == line_below_highlighted_range.strip() and len(line.strip()) > 4:
                        should_stop = True
                        break
                    await add_line(i, line)
                    i += 1

            # Add the unfinished line
            if unfinished_line != "":
                unfinished_line = unfinished_line.replace(
                    "</modified_code_to_edit>", "").replace("</code_to_edit>", "").replace("```", "").replace("</file_suffix>", "").replace("</file_prefix", "").replace(
                    "<modified_code_to_edit>", "").replace("<code_to_edit>", "").replace("<file_suffix>", "").replace("<file_prefix", "")
                if not i < len(original_lines) or not unfinished_line == original_lines[i]:
                    await add_line(i, unfinished_line)
                lines.append(unfinished_line)
                i += 1

            # Remove the leftover original lines
            while i < len(original_lines):
                range = Range.from_shorthand(
                    rif.range.start.line + i, rif.range.start.character, rif.range.start.line + i, len(original_lines[i]) + 1)
                await sdk.ide.applyFileSystemEdit(FileEdit(
                    filepath=rif.filepath,
                    range=range,
                    replacement=""
                ))
                i += 1

            completion = "\n".join(lines)

            self._prompt_and_completion += prompt + completion

            diff = list(difflib.ndiff(rif.contents.splitlines(
                keepends=True), completion.splitlines(keepends=True)))

            lines_to_highlight = set()
            index = 0
            for line in diff:
                if line.startswith("-"):
                    pass
                elif line.startswith("+"):
                    lines_to_highlight.add(index + rif.range.start.line)
                    index += 1
                elif line.startswith(" "):
                    index += 1

            current_hl_start = None
            last_hl = None
            rifs_to_highlight = []
            for line in lines_to_highlight:
                if current_hl_start is None:
                    current_hl_start = line
                elif line != last_hl + 1:
                    rifs_to_highlight.append(RangeInFile(
                        filepath=rif.filepath, range=Range.from_shorthand(current_hl_start, 0, last_hl, 0)))
                    current_hl_start = line
                last_hl = line

            if current_hl_start is not None:
                rifs_to_highlight.append(RangeInFile(
                    filepath=rif.filepath, range=Range.from_shorthand(current_hl_start, 0, last_hl, 0)))

            for rif_to_hl in rifs_to_highlight:
                await sdk.ide.highlightCode(rif_to_hl)

            await sdk.ide.saveFile(rif.filepath)


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
