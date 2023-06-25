import os
from ..core.main import ChatMessage, Step
from ..core.sdk import ContinueSDK
from .chat import SimpleChatStep


class DefaultOnTracebackStep(Step):
    output: str
    name: str = "Help With Traceback"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        # Add context for any files in the traceback that are in the workspace
        for line in self.output.split("\n"):
            segs = line.split(" ")
            for seg in segs:
                if seg.startswith(os.path.sep) and os.path.exists(seg) and os.path.commonprefix([seg, sdk.ide.workspace_directory]) == sdk.ide.workspace_directory:
                    file_contents = await sdk.ide.readFile(seg)
                    self.chat_context.append(ChatMessage(
                        role="user",
                        content=f"The contents of {seg}:\n```\n{file_contents}\n```",
                        summary=""
                    ))

        await sdk.run_step(SimpleChatStep(
            name="Help With Traceback",
            user_input=f"""I got the following error, can you please help explain how to fix it?\n\n{self.output}"""))
