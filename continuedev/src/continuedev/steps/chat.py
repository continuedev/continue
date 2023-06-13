from textwrap import dedent
from typing import List
from ..core.main import Step
from ..core.sdk import ContinueSDK
from .core.core import MessageStep


class SimpleChatStep(Step):
    user_input: str
    name: str = "Chat"

    async def run(self, sdk: ContinueSDK):
        self.description = f"## {self.user_input}\n\n"
        for chunk in sdk.models.default.stream_chat(self.user_input, with_history=await sdk.get_chat_context()):
            self.description += chunk
            await sdk.update_ui()

        self.name = sdk.models.gpt35.complete(
            f"Write a short title for the following chat message: {self.description}").strip()
