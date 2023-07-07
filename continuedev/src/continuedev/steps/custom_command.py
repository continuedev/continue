from ..core.main import Step
from ..core.sdk import ContinueSDK
from ..steps.core.core import UserInputStep
from ..steps.chat import ChatWithFunctions, SimpleChatStep


class CustomCommandStep(Step):
    name: str
    prompt: str
    user_input: str
    slash_command: str
    hide: bool = True

    async def describe(self):
        return self.prompt

    async def run(self, sdk: ContinueSDK):
        prompt_user_input = f"Task: {self.prompt}. Additional info: {self.user_input}"
        messages = await sdk.get_chat_context()
        # Find the last chat message with this slash command and replace it with the user input
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].role == "user" and messages[i].content.startswith(self.slash_command):
                messages[i] = messages[i].copy(
                    update={"content": prompt_user_input})
                break
        await sdk.run_step(SimpleChatStep(messages=messages))
