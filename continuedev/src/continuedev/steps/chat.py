from textwrap import dedent
from typing import List
from ..core.main import Step
from ..core.sdk import ContinueSDK
from .main import MessageStep


class SimpleChatStep(Step):
    user_input: str

    async def run(self, sdk: ContinueSDK):
        # TODO: With history
        self.description = await sdk.models.gpt35.complete(self.user_input)
