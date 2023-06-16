from ..core.main import Step
from ..core.sdk import ContinueSDK
from .chat import SimpleChatStep


class DefaultOnTracebackStep(Step):
    output: str
    name: str = "Help With Traceback"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(SimpleChatStep(
            name="Help With Traceback",
            user_input=f"""I got the following error, can you please help explain how to fix it?\n\n{self.output}"""))
