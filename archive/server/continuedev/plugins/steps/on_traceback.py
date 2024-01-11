import os
from textwrap import dedent
from typing import Dict, List, Optional, Tuple

from ...core.main import ChatMessage, ContinueCustomException, Step
from ...core.sdk import ContinueSDK
from ...core.steps import UserInputStep
from ...libs.util.filter_files import should_filter_path
from ...libs.util.telemetry import posthog_logger
from ...libs.util.traceback.traceback_parsers import (
    get_javascript_traceback,
    get_python_traceback,
    parse_python_traceback,
)
from ...models.filesystem import RangeInFile
from ...models.main import Range, Traceback, TracebackFrame
from .chat import SimpleChatStep


def extract_traceback_str(output: str) -> str:
    tb = output.strip()
    for tb_parser in [get_python_traceback, get_javascript_traceback]:
        if parsed_tb := tb_parser(tb):
            return parsed_tb

    return ""


class DefaultOnTracebackStep(Step):
    output: str
    name: str = "Help With Traceback"
    hide: bool = True

    async def find_relevant_files(self, sdk: ContinueSDK):
        # Add context for any files in the traceback that are in the workspace
        for line in self.output.split("\n"):
            segs = line.split(" ")
            for seg in segs:
                if (
                    seg.startswith(os.path.sep)
                    and os.path.exists(seg)  # TODO: Use sdk.ide.fileExists
                    and os.path.commonprefix([seg, sdk.ide.workspace_directory])
                    == sdk.ide.workspace_directory
                ):
                    file_contents = await sdk.ide.readFile(seg)
                    self.chat_context.append(
                        ChatMessage(
                            role="user",
                            content=f"The contents of {seg}:\n```\n{file_contents}\n```",
                            summary="",
                        )
                    )
        # TODO: The ideal is that these are added as context items, so then the user can see them
        # And this function is where you can get arbitrarily fancy about adding context

    async def run(self, sdk: ContinueSDK):
        if self.output.strip() == "":
            raise ContinueCustomException(
                title="No terminal open",
                message="You must have a terminal open in order to automatically debug with Continue.",
            )

        if get_python_traceback(self.output) is not None and sdk.lsp is not None:
            posthog_logger.capture_event("debug_terminal", {"language": "python"})
            await sdk.run_step(SolvePythonTracebackStep(output=self.output))
            return

        posthog_logger.capture_event("debug_terminal", {})

        tb = extract_traceback_str(self.output) or self.output[-8000:]

        prompt = f"""I got the following error, can you please help explain how to fix it?\n\n{tb}"""
        await sdk.run_step(UserInputStep(user_input=prompt, description=prompt))
        await sdk.run_step(SimpleChatStep(name="Help With Traceback"))


def filter_frames(frames: List[TracebackFrame]) -> List[TracebackFrame]:
    """Filter out frames that are not relevant to the user's code."""
    return list(filter(lambda x: should_filter_path(x.filepath), frames))


def find_external_call(
    frames: List[TracebackFrame],
) -> Optional[Tuple[TracebackFrame, TracebackFrame]]:
    """Moving up from the bottom of the stack, if the frames are not user code, then find the last frame before it becomes user code."""
    if not should_filter_path(frames[-1].filepath):
        # No external call, error comes directly from user code
        return None

    for i in range(len(frames) - 2, -1, -1):
        if not should_filter_path(frames[i].filepath):
            return frames[i], frames[i + 1]


def get_func_source_for_frame(frame: Dict) -> str:
    """Get the source for the function called in the frame."""
    return ""


async def fetch_docs_for_external_call(external_call: Dict, next_frame: Dict) -> str:
    """Fetch docs for the external call."""
    return ""


class SolvePythonTracebackStep(Step):
    output: str
    name: str = "Solve Traceback"
    hide: bool = True

    async def external_call_prompt(
        self, sdk: ContinueSDK, external_call: Tuple[Dict, Dict], tb_string: str
    ) -> str:
        external_call_dict, next_frame = external_call
        source_line = external_call_dict["source_line"]
        external_func_source = get_func_source_for_frame(next_frame)
        docs = await fetch_docs_for_external_call(external_call_dict, next_frame)

        prompt = dedent(
            f"""\
                    I got the following error:
                
                    {tb_string}

                    I tried to call an external library like this:

                    ```python
                    {source_line}
                    ```

                    This is the definition of the function I tried to call:

                    ```python
                    {external_func_source}
                    ```
                
                    Here's the documentation for the external library I tried to call:
                
                    {docs}

                    Explain how to fix the error.
                    """
        )

        return prompt

    async def normal_traceback_prompt(
        self, sdk: ContinueSDK, tb: Traceback, tb_string: str
    ) -> str:
        function_bodies = await get_functions_from_traceback(tb, sdk)

        prompt = (
            "Here are the functions from the traceback (most recent call last):\n\n"
        )
        for i, function_body in enumerate(function_bodies):
            prompt += f'File "{tb.frames[i].filepath}", line {tb.frames[i].lineno}, in {tb.frames[i].function}\n\n```python\n{function_body or tb.frames[i].code}\n```\n\n'

        prompt += (
            "Here is the traceback:\n\n```\n"
            + tb_string
            + "\n```\n\nExplain how to fix the error."
        )

        return prompt

    async def run(self, sdk: ContinueSDK):
        tb_string = get_python_traceback(self.output)
        tb = parse_python_traceback(tb_string or "")

        if external_call := find_external_call(tb.frames):
            prompt = await self.external_call_prompt(sdk, external_call, tb_string)
        else:
            prompt = await self.normal_traceback_prompt(sdk, tb, tb_string)

        await sdk.run_step(
            UserInputStep(
                user_input=prompt,
            )
        )
        await sdk.run_step(SimpleChatStep(name="Help With Traceback"))


async def get_function_body(frame: TracebackFrame, sdk: ContinueSDK) -> Optional[str]:
    """Get the function body from the traceback frame."""
    if sdk.lsp is None:
        return None

    document_symbols = await sdk.lsp.document_symbol(frame.filepath)
    for symbol in document_symbols:
        if symbol.name == frame.function:
            r = symbol.location.range
            return await sdk.ide.readRangeInFile(
                RangeInFile(
                    filepath=frame.filepath,
                    range=Range.from_shorthand(
                        r.start.line, r.start.character, r.end.line, r.end.character
                    ),
                )
            )
    return None


async def get_functions_from_traceback(tb: Traceback, sdk: ContinueSDK) -> List[str]:
    """Get the function bodies from the traceback."""
    function_bodies = []
    for frame in tb.frames:
        if frame.function:
            function_bodies.append(await get_function_body(frame, sdk))

    return function_bodies
