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
from ...core.main import ChatMessage, Step, SequentialStep
from ...libs.util.count_tokens import MAX_TOKENS_FOR_MODEL, DEFAULT_MAX_TOKENS
from ...libs.util.dedent import dedent_and_get_common_whitespace
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
    description: str = ""
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

    def _cleanup_output(self, output: str) -> str:
        output = output.replace('\\"', '"')
        output = output.replace("\\'", "'")
        output = output.replace("\\n", "\n")
        output = output.replace("\\t", "\t")
        output = output.replace("\\\\", "\\")
        if output.startswith('"') and output.endswith('"'):
            output = output[1:-1]

        return output

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        description = await models.gpt3516k.complete(dedent(f"""\
            {self._prompt_and_completion}
            
            Please give brief a description of the changes made above using markdown bullet points. Be concise and only mention changes made to the commit before, not prefix or suffix:"""))
        name = await models.gpt3516k.complete(f"Write a very short title to describe this requested change (no quotes): '{self.user_input}'. This is the title:")
        self.name = self._cleanup_output(name)

        return f"{self._cleanup_output(description)}"

    async def get_prompt_parts(self, rif: RangeInFileWithContents, sdk: ContinueSDK, full_file_contents: str):
        # We don't know here all of the functions being passed in.
        # We care because if this prompt itself goes over the limit, then the entire message will have to be cut from the completion.
        # Overflow won't happen, but prune_chat_messages in count_tokens.py will cut out this whole thing, instead of us cutting out only as many lines as we need.
        model_to_use = sdk.models.gpt4

        BUFFER_FOR_FUNCTIONS = 400
        total_tokens = model_to_use.count_tokens(
            full_file_contents + self._prompt + self.user_input) + BUFFER_FOR_FUNCTIONS + DEFAULT_MAX_TOKENS

        TOKENS_TO_BE_CONSIDERED_LARGE_RANGE = 1000
        if model_to_use.count_tokens(rif.contents) > TOKENS_TO_BE_CONSIDERED_LARGE_RANGE:
            self.description += "\n\n**It looks like you've selected a large range to edit, which may take a while to complete. If you'd like to cancel, click the 'X' button above. If you highlight a more specific range, Continue will only edit within it.**"

        # If using 3.5 and overflows, upgrade to 3.5.16k
        if model_to_use.name == "gpt-3.5-turbo":
            if total_tokens > MAX_TOKENS_FOR_MODEL["gpt-3.5-turbo"]:
                model_to_use = sdk.models.gpt3516k

        # Remove tokens from the end first, and then the start to clear space
        # This part finds the start and end lines
        full_file_contents_lst = full_file_contents.split("\n")
        max_start_line = rif.range.start.line
        min_end_line = rif.range.end.line
        cur_start_line = 0
        cur_end_line = len(full_file_contents_lst) - 1

        if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
            while cur_end_line > min_end_line:
                total_tokens -= model_to_use.count_tokens(
                    full_file_contents_lst[cur_end_line])
                cur_end_line -= 1
                if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                    break

            if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                while cur_start_line < max_start_line:
                    cur_start_line += 1
                    total_tokens -= model_to_use.count_tokens(
                        full_file_contents_lst[cur_end_line])
                    if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                        break

        # Now use the found start/end lines to get the prefix and suffix strings
        file_prefix = "\n".join(
            full_file_contents_lst[cur_start_line:max_start_line])
        file_suffix = "\n".join(
            full_file_contents_lst[min_end_line:cur_end_line - 1])

        # Move any surrounding blank line in rif.contents to the prefix/suffix
        # TODO: Keep track of start line of the range, because it's needed below for offset stuff
        rif_start_line = rif.range.start.line
        if len(rif.contents) > 0:
            lines = rif.contents.splitlines(keepends=True)
            first_line = lines[0] if lines else None
            while first_line and first_line.strip() == "":
                file_prefix += first_line
                rif.contents = rif.contents[len(first_line):]
                lines = rif.contents.splitlines(keepends=True)
                first_line = lines[0] if lines else None

            last_line = lines[-1] if lines else None
            while last_line and last_line.strip() == "":
                file_suffix = last_line + file_suffix
                rif.contents = rif.contents[:len(
                    rif.contents) - len(last_line)]
                lines = rif.contents.splitlines(keepends=True)
                last_line = lines[-1] if lines else None

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
        return "</modified_code_to_edit>" in line or "</code_to_edit>" in line

    def line_to_be_ignored(self, line: str, is_first_line: bool = False) -> bool:
        return "```" in line or "<modified_code_to_edit>" in line or "<file_prefix>" in line or "</file_prefix>" in line or "<file_suffix>" in line or "</file_suffix>" in line or "<user_request>" in line or "</user_request>" in line or "<code_to_edit>" in line

    async def stream_rif(self, rif: RangeInFileWithContents, sdk: ContinueSDK):
        await sdk.ide.saveFile(rif.filepath)
        full_file_contents = await sdk.ide.readFile(rif.filepath)

        file_prefix, contents, file_suffix, model_to_use = await self.get_prompt_parts(
            rif, sdk, full_file_contents)
        contents, common_whitespace = dedent_and_get_common_whitespace(
            contents)
        prompt = self.compile_prompt(file_prefix, contents, file_suffix, sdk)
        full_file_contents_lines = full_file_contents.split("\n")

        async def sendDiffUpdate(lines: List[str], sdk: ContinueSDK):
            nonlocal full_file_contents_lines, rif

            completion = "\n".join(lines)

            full_prefix_lines = full_file_contents_lines[:rif.range.start.line]
            full_suffix_lines = full_file_contents_lines[rif.range.end.line + 1:]
            new_file_contents = "\n".join(
                full_prefix_lines) + "\n" + completion + "\n" + "\n".join(full_suffix_lines)
            await sdk.ide.showDiff(rif.filepath, new_file_contents)

        # Important state variables
        # -------------------------
        original_lines = [] if rif.contents == "" else rif.contents.split("\n")
        # In the actual file, taking into account block offset
        current_line_in_file = rif.range.start.line
        current_block_lines = []
        original_lines_below_previous_blocks = original_lines
        # The start of the current block in file, taking into account block offset
        current_block_start = -1
        offset_from_blocks = 0

        # Don't end the block until you've matched N simultaneous lines
        # This helps avoid many tiny blocks
        LINES_TO_MATCH_BEFORE_ENDING_BLOCK = 2
        # If a line has been matched at the end of the block, this is its index within original_lines_below_previous_blocks
        # Except we are keeping track of multiple potentialities, so it's a list
        # We always check the lines following each of these leads, but if multiple make it out at the end, we use the first one
        # This is a tuple of (index_of_last_matched_line, number_of_lines_matched)
        indices_of_last_matched_lines = []

        async def handle_generated_line(line: str):
            nonlocal current_block_start, current_line_in_file, original_lines, original_lines_below_previous_blocks, current_block_lines, indices_of_last_matched_lines, LINES_TO_MATCH_BEFORE_ENDING_BLOCK, offset_from_blocks

            # Highlight the line to show progress
            line_to_highlight = current_line_in_file - len(current_block_lines)
            if False:
                await sdk.ide.highlightCode(RangeInFile(filepath=rif.filepath, range=Range.from_shorthand(
                    line_to_highlight, 0, line_to_highlight, 0)), "#FFFFFF22" if len(current_block_lines) == 0 else "#00FF0022")

            if len(current_block_lines) == 0:
                # Set this as the start of the next block
                current_block_start = rif.range.start.line + len(original_lines) - len(
                    original_lines_below_previous_blocks) + offset_from_blocks
                if len(original_lines_below_previous_blocks) > 0 and line == original_lines_below_previous_blocks[0]:
                    # Line is equal to the next line in file, move past this line
                    original_lines_below_previous_blocks = original_lines_below_previous_blocks[
                        1:]
                    return

            # In a block, and have already matched at least one line
            # Check if the next line matches, for each of the candidates
            matches_found = []
            first_valid_match = None
            for index_of_last_matched_line, num_lines_matched in indices_of_last_matched_lines:
                if index_of_last_matched_line + 1 < len(original_lines_below_previous_blocks) and line == original_lines_below_previous_blocks[index_of_last_matched_line + 1]:
                    matches_found.append(
                        (index_of_last_matched_line + 1, num_lines_matched + 1))
                    if first_valid_match is None and num_lines_matched + 1 >= LINES_TO_MATCH_BEFORE_ENDING_BLOCK:
                        first_valid_match = (
                            index_of_last_matched_line + 1, num_lines_matched + 1)
            indices_of_last_matched_lines = matches_found

            if first_valid_match is not None:
                # We've matched the required number of lines, insert suggestion!

                # We added some lines to the block that were matched (including maybe some blank lines)
                # So here we will strip all matching lines from the end of current_block_lines
                lines_stripped = []
                index_of_last_line_in_block = first_valid_match[0]
                while len(current_block_lines) > 0 and current_block_lines[-1] == original_lines_below_previous_blocks[index_of_last_line_in_block - 1]:
                    lines_stripped.append(current_block_lines.pop())
                    index_of_last_line_in_block -= 1

                # It's also possible that some lines match at the beginning of the block
                # lines_stripped_at_beginning = []
                # j = 0
                # while len(current_block_lines) > 0 and current_block_lines[0] == original_lines_below_previous_blocks[first_valid_match[0] - first_valid_match[1] + j]:
                #     lines_stripped_at_beginning.append(
                #         current_block_lines.pop(0))
                #     j += 1
                #     # current_block_start += 1

                # Insert the suggestion
                replacement = "\n".join(current_block_lines)
                start_line = current_block_start
                end_line = current_block_start + index_of_last_line_in_block

                if False:
                    await sdk.ide.showSuggestion(FileEdit(
                        filepath=rif.filepath,
                        range=Range.from_shorthand(
                            start_line, 0, end_line, 0),
                        replacement=replacement
                    ))

                # Reset current block / update variables
                current_line_in_file += 1
                offset_from_blocks += len(current_block_lines)
                original_lines_below_previous_blocks = original_lines_below_previous_blocks[
                    index_of_last_line_in_block + 1:]
                current_block_lines = []
                current_block_start = -1
                indices_of_last_matched_lines = []

                return

            # Always look for new matching candidates
            new_matches = []
            for i in range(len(original_lines_below_previous_blocks)):
                og_line = original_lines_below_previous_blocks[i]
                # TODO: It's a bit sus to be disqualifying empty lines.
                # What you ideally do is find ALL matches, and then throw them out as you check the following lines
                if og_line == line:  # and og_line.strip() != "":
                    new_matches.append((i, 1))
            indices_of_last_matched_lines += new_matches

            # Make sure they are sorted by index
            indices_of_last_matched_lines = sorted(
                indices_of_last_matched_lines, key=lambda x: x[0])

            current_block_lines.append(line)

        messages = await sdk.get_chat_context()
        messages.append(ChatMessage(
            role="user",
            content=prompt,
            summary=self.user_input
        ))

        lines_of_prefix_copied = 0
        lines = []
        unfinished_line = ""
        completion_lines_covered = 0
        repeating_file_suffix = False
        line_below_highlighted_range = file_suffix.lstrip().split("\n")[0]
        async for chunk in model_to_use.stream_chat(messages, temperature=0):
            # Stop early if it is repeating the file_suffix or the step was deleted
            if repeating_file_suffix:
                break
            if sdk.current_step_was_deleted():
                return

            # Accumulate lines
            if "content" not in chunk:
                continue
            chunk = chunk["content"]
            chunk_lines = chunk.split("\n")
            chunk_lines[0] = unfinished_line + chunk_lines[0]
            if chunk.endswith("\n"):
                unfinished_line = ""
                chunk_lines.pop()  # because this will be an empty string
            else:
                unfinished_line = chunk_lines.pop()
            lines.extend(map(lambda l: common_whitespace + l, chunk_lines))

            if True:
                await sendDiffUpdate(lines + [common_whitespace + unfinished_line], sdk)

            # Deal with newly accumulated lines
            for line in chunk_lines:
                # Trailing whitespace doesn't matter
                line = line.rstrip()

                # Lines that should signify the end of generation
                if self.is_end_line(line):
                    break
                # Lines that should be ignored, like the <> tags
                elif self.line_to_be_ignored(line, completion_lines_covered == 0):
                    continue
                # Check if we are currently just copying the prefix
                elif (lines_of_prefix_copied > 0 or completion_lines_covered == 0) and lines_of_prefix_copied < len(file_prefix.splitlines()) and line == full_file_contents_lines[lines_of_prefix_copied]:
                    # This is a sketchy way of stopping it from repeating the file_prefix. Is a bug if output happens to have a matching line
                    lines_of_prefix_copied += 1
                    continue
                # Because really short lines might be expected to be repeated, this is only a !heuristic!
                # Stop when it starts copying the file_suffix
                elif line.strip() == line_below_highlighted_range.strip() and len(line.strip()) > 4 and not (len(original_lines_below_previous_blocks) > 0 and line.strip() == original_lines_below_previous_blocks[0].strip()):
                    repeating_file_suffix = True
                    break

                # If none of the above, insert the line!
                if False:
                    await handle_generated_line(line)

                completion_lines_covered += 1
                current_line_in_file += 1

        # Add the unfinished line
        if unfinished_line != "" and not self.line_to_be_ignored(unfinished_line, completion_lines_covered == 0) and not self.is_end_line(unfinished_line):
            unfinished_line = common_whitespace + unfinished_line
            lines.append(unfinished_line)
            await handle_generated_line(unfinished_line)
            completion_lines_covered += 1
            current_line_in_file += 1

        await sendDiffUpdate(lines, sdk)

        if False:
            # If the current block isn't empty, add that suggestion
            if len(current_block_lines) > 0:
                # We have a chance to back-track here for blank lines that are repeats of the end of the original
                # Don't want to have the same ending in both the original and the generated, can just leave it there
                num_to_remove = 0
                for i in range(-1, -len(current_block_lines) - 1, -1):
                    if len(original_lines_below_previous_blocks) == 0:
                        break
                    if current_block_lines[i] == original_lines_below_previous_blocks[-1]:
                        num_to_remove += 1
                        original_lines_below_previous_blocks.pop()
                    else:
                        break
                current_block_lines = current_block_lines[:-
                                                          num_to_remove] if num_to_remove > 0 else current_block_lines

                # It's also possible that some lines match at the beginning of the block
                # while len(current_block_lines) > 0 and len(original_lines_below_previous_blocks) > 0 and current_block_lines[0] == original_lines_below_previous_blocks[0]:
                #     current_block_lines.pop(0)
                #     original_lines_below_previous_blocks.pop(0)
                #     current_block_start += 1

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
            await sdk.ide.setSuggestionsLocked(rif.filepath, True)
            await self.stream_rif(rif, sdk)
            await sdk.ide.setSuggestionsLocked(rif.filepath, False)


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
    hide: bool = False

    manage_own_chat_context: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.user_input

    async def run(self, sdk: ContinueSDK) -> Coroutine[UserInputObservation, None, None]:
        self.chat_context.append(ChatMessage(
            role="user",
            content=self.user_input,
            summary=self.user_input
        ))
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
