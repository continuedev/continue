import os

from ...core.main import ChatMessage, Step
from ...core.sdk import ContinueSDK
from ...libs.util.traceback_parsers import (
    get_javascript_traceback,
    get_python_traceback,
)
from .chat import SimpleChatStep
from .core.core import UserInputStep


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
        tb = self.output.strip()
        for tb_parser in [get_python_traceback, get_javascript_traceback]:
            if parsed_tb := tb_parser(tb):
                tb = parsed_tb
                break

        await sdk.run_step(
            UserInputStep(
                user_input=f"""I got the following error, can you please help explain how to fix it?\n\n{tb}"""
            )
        )
        await sdk.run_step(SimpleChatStep(name="Help With Traceback"))
