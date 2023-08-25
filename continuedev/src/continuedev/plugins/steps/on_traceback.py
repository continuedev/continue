import os
from textwrap import dedent
from typing import Dict, List, Optional, Tuple

from ...core.main import ChatMessage, Step
from ...core.sdk import ContinueSDK
from ...libs.util.filter_files import should_filter_path
from ...libs.util.traceback.traceback_parsers import (
    get_javascript_traceback,
    get_python_traceback,
    parse_python_traceback,
)
from .chat import SimpleChatStep
from .core.core import UserInputStep


def extract_traceback_str(output: str) -> str:
    tb = output.strip()
    for tb_parser in [get_python_traceback, get_javascript_traceback]:
        if parsed_tb := tb_parser(tb):
            return parsed_tb


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
                    and os.path.exists(seg)
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
        tb = extract_traceback_str(self.output)

        tb_first_last_lines = (
            ("\n".join(tb.split("\n")[:3]) + "\n...\n" + "\n".join(tb.split("\n")[-3:]))
            if len(tb.split("\n")) > 6
            else tb
        )

        await sdk.run_step(
            UserInputStep(
                description=f"""I got the following error, can you please help explain how to fix it?\n\n{tb_first_last_lines}""",
                user_input=f"""I got the following error, can you please help explain how to fix it?\n\n{tb}""",
            )
        )
        await sdk.run_step(SimpleChatStep(name="Help With Traceback"))


def filter_frames(frames: List[Dict]) -> List[Dict]:
    """Filter out frames that are not relevant to the user's code."""
    return list(filter(lambda x: should_filter_path(x["filepath"]), frames))


def find_external_call(frames: List[Dict]) -> Optional[Tuple[Dict, Dict]]:
    """Moving up from the bottom of the stack, if the frames are not user code, then find the last frame before it becomes user code."""
    if not should_filter_path(frames[-1]["filepath"]):
        # No external call, error comes directly from user code
        return None

    for i in range(len(frames) - 2, -1, -1):
        if not should_filter_path(frames[i]["filepath"]):
            return frames[i], frames[i + 1]


def get_func_source_for_frame(frame: Dict) -> str:
    """Get the source for the function called in the frame."""
    pass


async def fetch_docs_for_external_call(external_call: Dict, next_frame: Dict) -> str:
    """Fetch docs for the external call."""
    pass


class SolvePythonTracebackStep(Step):
    output: str
    name: str = "Solve Traceback"

    async def handle_external_call(
        self, sdk: ContinueSDK, external_call: Tuple[Dict, Dict], tb_string: str
    ):
        external_call, next_frame = external_call
        source_line = external_call["source_line"]
        external_func_source = get_func_source_for_frame(next_frame)
        docs = await fetch_docs_for_external_call(external_call, next_frame)

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

        completion = await sdk.models.default.complete(prompt)
        print(completion)

    async def run(self, sdk: ContinueSDK):
        tb_string = get_python_traceback(self.output)
        tb = parse_python_traceback(tb_string)

        if external_call := find_external_call(tb.frames):
            await self.handle_external_call(sdk, external_call, tb_string)
        else:
            pass
