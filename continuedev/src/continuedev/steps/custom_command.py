from ..core.main import Step
from ..core.sdk import ContinueSDK
from ..steps.chat import ChatWithFunctions, SimpleChatStep


class CustomCommandStep(Step):
    name: str
    prompt: str
    user_input: str
    hide: bool = True

    async def describe(self):
        return self.prompt

    async def run(self, sdk: ContinueSDK):
        prompt_user_input = f"Task: {self.prompt}. Additional info: {self.user_input}"
        await sdk.run_step(SimpleChatStep(user_input=prompt_user_input))
