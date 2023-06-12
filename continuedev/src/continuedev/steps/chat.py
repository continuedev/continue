from textwrap import dedent
from typing import List
from ..core.main import Step
from ..core.sdk import ContinueSDK
from .core.core import MessageStep


class SimpleChatStep(Step):
    user_input: str

    async def run(self, sdk: ContinueSDK):
        self.description = sdk.models.gpt35.complete(self.user_input, with_history=await sdk.get_chat_context())
