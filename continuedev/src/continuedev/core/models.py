from typing import Optional

from pydantic import BaseModel

from ..libs.llm import LLM


class ContinueSDK(BaseModel):
    pass


class Models(BaseModel):
    """Main class that holds the current model configuration"""

    default: LLM
    small: Optional[LLM] = None
    medium: Optional[LLM] = None
    large: Optional[LLM] = None

    # TODO namespace these away to not confuse readers,
    # or split Models into ModelsConfig, which gets turned into Models
    sdk: ContinueSDK = None

    @property
    def all_models(self):
        models = [self.default, self.small, self.medium, self.large]
        return [model for model in models if model is not None]

    @property
    def system_message(self) -> Optional[str]:
        if self.sdk:
            return self.sdk.config.system_message
        return None

    def set_system_message(self, msg: str):
        for model in self.all_models:
            model.system_message = msg

    async def start(self, sdk: "ContinueSDK"):
        """Start each of the LLMs, or fall back to default"""
        self.sdk = sdk
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

        self.set_system_message(self.system_message)

    async def stop(self, sdk: "ContinueSDK"):
        """Stop each LLM (if it's not the default, which is shared)"""
        await self.default.stop()
        if self.small is not self.default:
            await self.small.stop()
        if self.medium is not self.default:
            await self.medium.stop()
        if self.large is not self.default:
            await self.large.stop()
