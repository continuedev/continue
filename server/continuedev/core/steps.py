# These steps are depended upon by ContinueSDK
import difflib
import subprocess
import time
from textwrap import dedent
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

from pydantic import Field

from ..libs.llm.base import LLM
from ..libs.llm.openai_free_trial import OpenAIFreeTrial
from ..libs.util.count_tokens import DEFAULT_MAX_TOKENS
from ..libs.util.devdata import dev_data_logger
from ..libs.util.strings import (
    dedent_and_get_common_whitespace,
    remove_quotes_and_escapes,
)
from ..libs.util.telemetry import posthog_logger
from ..libs.util.templating import render_prompt_template
from ..models.filesystem import FileSystem, RangeInFile, RangeInFileWithContents
from ..models.filesystem_edit import EditDiff, FileEditWithFullContents, FileSystemEdit
from .abstract_sdk import AbstractContinueSDK
from .main import (
    ChatMessage,
    ContextItem,
    ContinueCustomException,
    DeltaStep,
    SessionUpdate,
    SetStep,
    Step,
)
from .observation import TextObservation, UserInputObservation


class Models:
    default: LLM
    summarize: LLM = Field(default=None)
    edit: LLM = Field(default=None)
    chat: LLM = Field(default=None)


class ReversibleStep(Step):
    async def reverse(self, sdk: AbstractContinueSDK):
        raise NotImplementedError


class MessageStep(Step):
    name: str = "Message"
    message: str

    async def describe(self, models: Models):
        return self.message

    async def run(self, sdk: AbstractContinueSDK):
        yield TextObservation(text=self.message)


class DisplayErrorStep(Step):
    name: str = "Error in the Continue server"

    title: str = "Error in the Continue server"
    message: str = "There was an error in the Continue server."

    @staticmethod
    def from_exception(e: Exception) -> "DisplayErrorStep":
        if isinstance(e, ContinueCustomException):
            return DisplayErrorStep(title=e.title, message=e.message, name=e.title)

        return DisplayErrorStep(message=str(e))

    class Config:
        arbitrary_types_allowed = True

    async def describe(self, models: Models):
        return self.message

    async def run(self, sdk: AbstractContinueSDK):
        raise ContinueCustomException(message=self.message, title=self.title)


class FileSystemEditStep(ReversibleStep):
    edit: FileSystemEdit
    _diff: Union[EditDiff, None] = None

    hide: bool = True

    async def run(self, sdk: "AbstractContinueSDK"):
        self._diff = await sdk.ide.applyFileSystemEdit(self.edit)

    async def reverse(self, sdk: "AbstractContinueSDK"):
        if self._diff:
            await sdk.ide.applyFileSystemEdit(self._diff.backward)


def output_contains_error(output: str) -> bool:
    return "Traceback" in output or "SyntaxError" in output


AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class ShellCommandsStep(Step):
    cmds: List[str]
    cwd: Union[str, None] = None
    name: str = "Run Shell Commands"
    handle_error: bool = True

    _err_text: Union[str, None] = None

    async def describe(self, models: Models) -> str:
        if self._err_text is not None:
            return f"Error when running shell commands:\n```\n{self._err_text}\n```"

        cmds_str = "\n".join(self.cmds)
        return await models.summarize.complete(
            f"{cmds_str}\n\nSummarize what was done in these shell commands, using markdown bullet points:"
        )

    async def run(self, sdk: AbstractContinueSDK):
        process = subprocess.Popen(
            "/bin/bash",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            cwd=self.cwd or sdk.ide.workspace_directory,
        )

        stdin_input = "\n".join(self.cmds)
        out, err_bytes = process.communicate(stdin_input.encode())
        err = err_bytes.decode()

        # If it fails, return the error
        if err is not None and err != "":
            self._err_text = err
            return TextObservation(text=err)


class DefaultModelEditCodeStep(Step):
    user_input: str
    model: Optional[LLM] = None
    range_in_files: List[RangeInFile]
    name: str = "Editing Code"
    hide = False
    description: str = ""
    _prompt: str = dedent(
        """\
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
        """
    )
    _previous_contents: str = ""
    _new_contents: str = ""
    _prompt_and_completion: str = ""

    summary_prompt: str = "Please briefly explain the changes made to the code above. Give no more than 2-3 sentences, and use markdown bullet points:"

    async def describe(self, models: Models):
        name = await models.summarize.complete(
            f"Write a very short title to describe this requested change (no quotes): '{self.user_input}'. This is the title:"
        )
        self.name = remove_quotes_and_escapes(name)

        if self._previous_contents.strip() == self._new_contents.strip():
            return "No edits were made"
        else:
            return None

    def on_stop(self, sdk: AbstractContinueSDK):
        index = len(sdk.history)
        for i in range(index - 1, -1, -1):
            yield SessionUpdate(index=i, update=SetStep(hide=True))
            if sdk.history[i].step_type == "UserInputStep":
                break

    async def get_prompt_parts(
        self,
        rif: RangeInFileWithContents,
        sdk: AbstractContinueSDK,
        full_file_contents: str,
    ):
        # We don't know here all of the functions being passed in.
        # We care because if this prompt itself goes over the limit, then the entire message will have to be cut from the completion.
        # Overflow won't happen, but prune_chat_messages in count_tokens.py will cut out this whole thing, instead of us cutting out only as many lines as we need.

        model_to_use = self.model or sdk.models.edit
        max_tokens = int(model_to_use.context_length / 2)

        TOKENS_TO_BE_CONSIDERED_LARGE_RANGE = 1200
        if (
            model_to_use.count_tokens(rif.contents)
            > TOKENS_TO_BE_CONSIDERED_LARGE_RANGE
        ):
            self.description += "\n\n**It looks like you've selected a large range to edit, which may take a while to complete. If you'd like to cancel, click the 'X' button above. If you highlight a more specific range, Continue will only edit within it.**"

            # At this point, we also increase the max_tokens parameter so it doesn't stop in the middle of generation
            # Increase max_tokens to be double the size of the range
            # But don't exceed twice default max tokens
            max_tokens = int(
                min(model_to_use.count_tokens(rif.contents), DEFAULT_MAX_TOKENS) * 2.5
            )

        BUFFER_FOR_FUNCTIONS = 400
        total_tokens = (
            model_to_use.count_tokens(
                full_file_contents + self._prompt + self.user_input
            )
            + BUFFER_FOR_FUNCTIONS
            + max_tokens
        )

        # If using 3.5 and overflows, upgrade to 3.5.16k
        if (
            model_to_use.model == "gpt-3.5-turbo"
            and model_to_use.__class__.__name__ == "OpenAI"
        ):
            if total_tokens > model_to_use.context_length:
                model_to_use = OpenAIFreeTrial(model="gpt-3.5-turbo-0613")

        # Remove tokens from the end first, and then the start to clear space
        # This part finds the start and end lines
        full_file_contents_lst = full_file_contents.split("\n")
        max_start_line = rif.range.start.line
        min_end_line = rif.range.end.line
        cur_start_line = 0
        cur_end_line = len(full_file_contents_lst) - 1

        if total_tokens > model_to_use.context_length:
            while cur_end_line > min_end_line:
                total_tokens -= model_to_use.count_tokens(
                    full_file_contents_lst[cur_end_line]
                )
                cur_end_line -= 1
                if total_tokens < model_to_use.context_length:
                    break

        if total_tokens > model_to_use.context_length:
            while cur_start_line < max_start_line:
                cur_start_line += 1
                total_tokens -= model_to_use.count_tokens(
                    full_file_contents_lst[cur_start_line]
                )
                if total_tokens < model_to_use.context_length:
                    break

        # Now use the found start/end lines to get the prefix and suffix strings
        file_prefix = "\n".join(full_file_contents_lst[cur_start_line:max_start_line])
        file_suffix = "\n".join(full_file_contents_lst[min_end_line : cur_end_line - 1])

        # Move any surrounding blank line in rif.contents to the prefix/suffix
        # TODO: Keep track of start line of the range, because it's needed below for offset stuff
        if len(rif.contents) > 0:
            lines = rif.contents.splitlines(keepends=True)
            first_line = lines[0] if lines else None
            while first_line and first_line.strip() == "":
                file_prefix += first_line
                rif.contents = rif.contents[len(first_line) :]
                lines = rif.contents.splitlines(keepends=True)
                first_line = lines[0] if lines else None

            last_line = lines[-1] if lines else None
            while last_line and last_line.strip() == "":
                file_suffix = last_line + file_suffix
                rif.contents = rif.contents[: len(rif.contents) - len(last_line)]
                lines = rif.contents.splitlines(keepends=True)
                last_line = lines[-1] if lines else None

            while rif.contents.startswith("\n"):
                file_prefix += "\n"
                rif.contents = rif.contents[1:]
            while rif.contents.endswith("\n"):
                file_suffix = "\n" + file_suffix
                rif.contents = rif.contents[:-1]

        return file_prefix, rif.contents, file_suffix, model_to_use, max_tokens

    def compile_prompt(
        self,
        file_prefix: str,
        contents: str,
        file_suffix: str,
        sdk: AbstractContinueSDK,
    ) -> str:
        if contents.strip() == "":
            # Separate prompt for insertion at the cursor, the other tends to cause it to repeat whole file
            prompt = dedent(
                f"""\
<file_prefix>
{file_prefix}
</file_prefix>
<insertion_code_here>
<file_suffix>
{file_suffix}
</file_suffix>
<user_request>
{self.user_input}
</user_request>

Please output the code to be inserted at the cursor in order to fulfill the user_request. Do NOT preface your answer or write anything other than code. You should not write any tags, just the code. Make sure to correctly indent the code:"""
            )
            return prompt

        prompt = self._prompt
        if file_prefix.strip() != "":
            prompt += dedent(
                f"""
<file_prefix>
{file_prefix}
</file_prefix>"""
            )
        prompt += dedent(
            f"""
<code_to_edit>
{contents}
</code_to_edit>"""
        )
        if file_suffix.strip() != "":
            prompt += dedent(
                f"""
<file_suffix>
{file_suffix}
</file_suffix>"""
            )
        prompt += dedent(
            f"""
<user_request>
{self.user_input}
</user_request>
<modified_code_to_edit>
"""
        )

        return prompt

    def is_end_line(self, line: str) -> bool:
        return (
            "</modified_code_to_edit>" in line
            or "</code_to_edit>" in line
            or "[/CODE]" in line
        )

    def line_to_be_ignored(self, line: str, is_first_line: bool = False) -> bool:
        return (
            "```" in line
            or "<modified_code_to_edit>" in line
            or "<file_prefix>" in line
            or "</file_prefix>" in line
            or "<file_suffix>" in line
            or "</file_suffix>" in line
            or "<user_request>" in line
            or "</user_request>" in line
            or "<code_to_edit>" in line
        )

    async def stream_rif(
        self, rif: RangeInFileWithContents, sdk: AbstractContinueSDK
    ) -> AsyncGenerator[SetStep, None]:
        await sdk.ide.saveFile(rif.filepath)
        full_file_contents = await sdk.ide.readFile(rif.filepath)

        (
            file_prefix,
            contents,
            file_suffix,
            model_to_use,
            max_tokens,
        ) = await self.get_prompt_parts(rif, sdk, full_file_contents)
        contents, common_whitespace = dedent_and_get_common_whitespace(contents)
        prompt = self.compile_prompt(file_prefix, contents, file_suffix, sdk)
        full_file_contents_lines = full_file_contents.split("\n")

        lines_to_display = []

        async def sendDiffUpdate(
            lines: List[str], sdk: AbstractContinueSDK, final: bool = False
        ):
            nonlocal full_file_contents_lines, rif, lines_to_display

            completion = "\n".join(lines)

            full_prefix_lines = full_file_contents_lines[: rif.range.start.line]
            full_suffix_lines = full_file_contents_lines[rif.range.end.line :]

            # Don't do this at the very end, just show the inserted code
            if final:
                lines_to_display = []

            # Only recalculate at every new-line, because this is sort of expensive
            elif completion.endswith("\n"):
                contents_lines = rif.contents.split("\n")
                rewritten_lines = 0
                for line in lines:
                    for i in range(rewritten_lines, len(contents_lines)):
                        if (
                            difflib.SequenceMatcher(
                                None, line, contents_lines[i]
                            ).ratio()
                            > 0.7
                            and contents_lines[i].strip() != ""
                        ):
                            rewritten_lines = i + 1
                            break
                lines_to_display = contents_lines[rewritten_lines:]

            new_file_contents = (
                "\n".join(full_prefix_lines)
                + "\n"
                + completion
                + "\n"
                + (
                    "\n".join(lines_to_display) + "\n"
                    if len(lines_to_display) > 0
                    else ""
                )
                + "\n".join(full_suffix_lines)
            )

            step_index = len(sdk.history) - 1

            await sdk.ide.showDiff(rif.filepath, new_file_contents, step_index)

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

            if len(current_block_lines) == 0:
                # Set this as the start of the next block
                current_block_start = (
                    rif.range.start.line
                    + len(original_lines)
                    - len(original_lines_below_previous_blocks)
                    + offset_from_blocks
                )
                if (
                    len(original_lines_below_previous_blocks) > 0
                    and line == original_lines_below_previous_blocks[0]
                ):
                    # Line is equal to the next line in file, move past this line
                    original_lines_below_previous_blocks = (
                        original_lines_below_previous_blocks[1:]
                    )
                    return

            # In a block, and have already matched at least one line
            # Check if the next line matches, for each of the candidates
            matches_found = []
            first_valid_match = None
            for (
                index_of_last_matched_line,
                num_lines_matched,
            ) in indices_of_last_matched_lines:
                if (
                    index_of_last_matched_line + 1
                    < len(original_lines_below_previous_blocks)
                    and line
                    == original_lines_below_previous_blocks[
                        index_of_last_matched_line + 1
                    ]
                ):
                    matches_found.append(
                        (index_of_last_matched_line + 1, num_lines_matched + 1)
                    )
                    if (
                        first_valid_match is None
                        and num_lines_matched + 1 >= LINES_TO_MATCH_BEFORE_ENDING_BLOCK
                    ):
                        first_valid_match = (
                            index_of_last_matched_line + 1,
                            num_lines_matched + 1,
                        )
            indices_of_last_matched_lines = matches_found

            if first_valid_match is not None:
                # We've matched the required number of lines, insert suggestion!

                # We added some lines to the block that were matched (including maybe some blank lines)
                # So here we will strip all matching lines from the end of current_block_lines
                lines_stripped = []
                index_of_last_line_in_block = first_valid_match[0]
                while (
                    len(current_block_lines) > 0
                    and current_block_lines[-1]
                    == original_lines_below_previous_blocks[
                        index_of_last_line_in_block - 1
                    ]
                ):
                    lines_stripped.append(current_block_lines.pop())
                    index_of_last_line_in_block -= 1

                # Reset current block / update variables
                current_line_in_file += 1
                offset_from_blocks += len(current_block_lines)
                original_lines_below_previous_blocks = (
                    original_lines_below_previous_blocks[
                        index_of_last_line_in_block + 1 :
                    ]
                )
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
                indices_of_last_matched_lines, key=lambda x: x[0]
            )

            current_block_lines.append(line)

        messages = await sdk.get_chat_context()
        # Delete the last user and assistant messages
        i = len(messages) - 1
        deleted = 0
        while i >= 0 and deleted < 2:
            if messages[i].role == "user" or messages[i].role == "assistant":
                messages.pop(i)
                deleted += 1
            i -= 1
        messages.append(
            ChatMessage(role="user", content=prompt, summary=self.user_input)
        )

        lines_of_prefix_copied = 0
        lines = []
        unfinished_line = ""
        completion_lines_covered = 0
        repeating_file_suffix = False
        line_below_highlighted_range = file_suffix.lstrip().split("\n")[0]

        # Use custom templates defined by the model
        if template := model_to_use.prompt_templates.get("edit"):
            rendered = render_prompt_template(
                template if isinstance(template, str) else template.prompt,
                messages[:-1],
                {
                    "code_to_edit": rif.contents,
                    "user_input": self.user_input,
                    "file_prefix": file_prefix,
                    "file_suffix": file_suffix,
                    "system_message": model_to_use.system_message
                    or sdk.config.system_message
                    or "",
                    "context_items": "\n\n".join(
                        list(
                            map(
                                lambda x: x.content or "",
                                await sdk.get_context_item_chat_messages(),
                            )
                        )
                    ),
                },
            )
            if isinstance(rendered, str):
                messages = [
                    ChatMessage(
                        role="user",
                        content=rendered,
                        summary=self.user_input,
                    )
                ]
            else:
                messages = rendered

            params: Dict[str, Any] = {"prompt": rendered}
            if template.__class__.__name__ == "PromptTemplate":
                params.update(template.dict(exclude={"prompt"}))  # type: ignore

            params.update(
                {"max_tokens": min(max_tokens, model_to_use.context_length // 2, 4096)}
            )
            generator = model_to_use.stream_complete(**params)

        else:

            async def gen():
                async for chunk in model_to_use.stream_chat(
                    messages,
                    temperature=sdk.config.completion_options.temperature,
                    max_tokens=min(max_tokens, model_to_use.context_length // 2, 4096),
                ):
                    yield chunk.content

            generator = gen()

        posthog_logger.capture_event(
            "model_use",
            {"model": model_to_use.model, "provider": model_to_use.__class__.__name__},
        )
        dev_data_logger.capture(
            "model_use",
            {"model": model_to_use.model, "provider": model_to_use.__class__.__name__},
        )

        try:
            last_task_time = time.time()
            async for chunk in generator:
                yield SetStep(
                    hide=False
                )  # Doing this so that there are breakpoints for cancellation

                # Stop early if it is repeating the file_suffix or the step was deleted
                if repeating_file_suffix:
                    break

                # Accumulate lines
                chunk_lines = chunk.split("\n")
                chunk_lines[0] = unfinished_line + chunk_lines[0]
                if chunk.endswith("\n"):
                    unfinished_line = ""
                    chunk_lines.pop()  # because this will be an empty string
                else:
                    unfinished_line = chunk_lines.pop()

                # Deal with newly accumulated lines
                for i in range(len(chunk_lines)):
                    # Trailing whitespace doesn't matter
                    chunk_lines[i] = chunk_lines[i].rstrip()
                    chunk_lines[i] = common_whitespace + chunk_lines[i]

                    # Lines that should signify the end of generation
                    if self.is_end_line(chunk_lines[i]):
                        break
                    # Lines that should be ignored, like the <> tags
                    elif self.line_to_be_ignored(
                        chunk_lines[i], completion_lines_covered == 0
                    ):
                        continue  # noice
                    # Check if we are currently just copying the prefix
                    elif (
                        (lines_of_prefix_copied > 0 or completion_lines_covered == 0)
                        and lines_of_prefix_copied < len(file_prefix.splitlines())
                        and chunk_lines[i]
                        == full_file_contents_lines[lines_of_prefix_copied]
                    ):
                        # This is a sketchy way of stopping it from repeating the file_prefix. Is a bug if output happens to have a matching line
                        lines_of_prefix_copied += 1
                        continue  # also nice
                    # Because really short lines might be expected to be repeated, this is only a !heuristic!
                    # Stop when it starts copying the file_suffix
                    elif (
                        chunk_lines[i].strip() == line_below_highlighted_range.strip()
                        and len(chunk_lines[i].strip()) > 4
                        and not (
                            len(original_lines_below_previous_blocks) > 0
                            and chunk_lines[i].strip()
                            == original_lines_below_previous_blocks[0].strip()
                        )
                    ):
                        repeating_file_suffix = True
                        break

                    lines.append(chunk_lines[i])
                    completion_lines_covered += 1
                    current_line_in_file += 1

                # Debounce the diff updates, last in only out for each period
                if last_task_time is None or time.time() - last_task_time > 0.15:
                    last_task_time = time.time()
                    await sendDiffUpdate(
                        lines
                        + [
                            common_whitespace
                            if unfinished_line.startswith("<")
                            else (common_whitespace + unfinished_line)
                        ],
                        sdk,
                    )

        finally:
            await generator.aclose()

        # Add the unfinished line
        if (
            unfinished_line != ""
            and not self.line_to_be_ignored(
                unfinished_line, completion_lines_covered == 0
            )
            and not self.is_end_line(unfinished_line)
        ):
            unfinished_line = common_whitespace + unfinished_line
            lines.append(unfinished_line)
            await handle_generated_line(unfinished_line)
            completion_lines_covered += 1
            current_line_in_file += 1

        await sendDiffUpdate(lines, sdk, final=True)

        # Record the completion
        completion = "\n".join(lines)
        self._previous_contents = "\n".join(original_lines)
        self._new_contents = completion
        self._prompt_and_completion += prompt + completion

    async def run(self, sdk: AbstractContinueSDK):
        rif_with_contents = []
        for range_in_file in map(
            lambda x: RangeInFile(
                filepath=x.filepath,
                # Only consider the range line-by-line. Maybe later don't if it's only a single line.
                range=x.range.to_full_lines(),
            ),
            self.range_in_files,
        ):
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents)
            )

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        for rif in rif_with_contents:
            await sdk.ide.setSuggestionsLocked(rif.filepath, True)
            async for update in self.stream_rif(rif, sdk):
                yield update
            await sdk.ide.setSuggestionsLocked(rif.filepath, False)

        changes = "\n".join(
            difflib.ndiff(
                self._previous_contents.splitlines(),
                self._new_contents.splitlines(),
            )
        )

        if sdk.config.disable_summaries:
            yield SetStep(
                name="",
                description=f"Edited {len(self.range_in_files)} files",
            )
        else:
            yield SetStep(
                name="Generating summary",
                description="",
            )
            async for chunk in sdk.models.summarize.stream_complete(
                dedent(
                    f"""\
            Diff summary: "{self.user_input}"

            ```diff
            {changes}
            ```

            {self.summary_prompt}"""
                )
            ):
                yield chunk

        # TODO: Follow-up edits might die with this update???
        sdk.context.set("last_edit_user_input", self.user_input)
        sdk.context.set("last_edit_diff", changes)
        sdk.context.set("last_edit_range", self.range_in_files[-1].range)


class EditFileStep(Step):
    filepath: str
    prompt: str
    hide: bool = True
    model: Optional[LLM] = None

    async def describe(self, models: Models):
        return "Editing file: " + self.filepath

    async def run(self, sdk: AbstractContinueSDK):
        file_contents = await sdk.ide.readFile(self.filepath)
        await sdk.run_step(
            DefaultModelEditCodeStep(
                range_in_files=[
                    RangeInFile.from_entire_file(self.filepath, file_contents)
                ],
                user_input=self.prompt,
                model=self.model,
            )
        )


class ManualEditStep(ReversibleStep):
    edit_diff: EditDiff
    hide: bool = True

    hide: bool = True

    async def describe(self, models: Models):
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
            _, diff = FileSystem.apply_edit_to_str(edit.fileContents, edit.fileEdit)
            diffs.append(diff)
        return cls(edit_diff=EditDiff.from_sequence(diffs))

    async def run(self, sdk: AbstractContinueSDK):
        ...

    async def reverse(self, sdk: AbstractContinueSDK):
        await sdk.ide.applyFileSystemEdit(self.edit_diff.backward)


class UserInputStep(Step):
    user_input: str
    context_items: List[ContextItem] = []
    name: str = "User Input"
    hide: bool = False

    manage_own_chat_context: bool = True

    async def describe(self, models: Models):
        if self.description is not None:
            return self.description
        return self.user_input

    async def run(self, sdk: AbstractContinueSDK):
        self.chat_context.append(
            ChatMessage(role="user", content=self.user_input, summary=self.user_input)
        )
        self.description = self.user_input
        yield UserInputObservation(user_input=self.user_input)
