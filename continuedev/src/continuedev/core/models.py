from typing import Optional, Any
from pydantic import BaseModel, validator
from ..libs.llm import LLM


class Models(BaseModel):
    """Main class that holds the current model configuration"""
    default: LLM
    small: Optional[LLM] = None
    medium: Optional[LLM] = None
    large: Optional[LLM] = None

    # TODO namespace these away to not confuse readers,
    # or split Models into ModelsConfig, which gets turned into Models
    sdk: "ContinueSDK" = None
    system_message: Any = None

    """
    Better to have sdk.llm.stream_chat(messages, model="claude-2").
    Then you also don't care that it' async.
    And it's easier to add more models.
    And intermediate shared code is easier to add.
    And you can make constants like ContinueModels.GPT35 = "gpt-3.5-turbo"
    PromptTransformer would be a good concept: You pass a prompt or list of messages and a model, then it outputs the prompt for that model.
    Easy to reason about, can place anywhere.
    And you can even pass a Prompt object to sdk.llm.stream_chat maybe, and it'll automatically be transformed for the given model.
    This can all happen inside of Models?

    class Prompt:
        def __init__(self, ...info):
            '''take whatever info is needed to describe the prompt'''

        def to_string(self, model: str) -> str:
            '''depending on the model, return the single prompt string'''
    """

    async def start(self, sdk: "ContinueSDK"):
        """Start each of the LLMs, or fall back to default"""
        self.sdk = sdk
        self.system_message = self.sdk.config.system_message
        await sdk.start_model(self.default)
        if self.small:
            await sdk.start_model(self.small)
        else:
            self.small = self.default

        if self.medium:
            await sdk.start_model(self.medium)
        else:
            self.medium = self.default

        if self.large:
            await sdk.start_model(self.large)
        else:
            self.large = self.default

    async def stop(self, sdk: "ContinueSDK"):
        """Stop each LLM (if it's not the default, which is shared)"""
        await self.default.stop()
        if self.small is not self.default:
            await self.small.stop()
        if self.medium is not self.default:
            await self.medium.stop()
        if self.large is not self.default:
            await self.large.stop()
