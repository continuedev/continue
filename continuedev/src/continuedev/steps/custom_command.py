from ..core.main import Step
from ..core.sdk import ContinueSDK
from ..steps.chat import ChatWithFunctions


class CustomCommandStep(Step):
    name: str
    prompt: str
    user_input: str
        
    async def describe(self):
        return self.prompt

    async def run(self, sdk: ContinueSDK):
        prompt_user_input = f"Task: {self.prompt}. Additional info: {self.user_input}"
        await sdk.run_step(ChatWithFunctions(user_input=prompt_user_input))