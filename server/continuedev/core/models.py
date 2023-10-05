from typing import List, Optional

from pydantic import BaseModel

from ..libs.llm.anthropic import AnthropicLLM
from ..libs.llm.base import LLM
from ..libs.llm.ggml import GGML
from ..libs.llm.google_palm_api import GooglePaLMAPI
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.hf_tgi import HuggingFaceTGI
from ..libs.llm.llamacpp import LlamaCpp
from ..libs.llm.ollama import Ollama
from ..libs.llm.openai import OpenAI
from ..libs.llm.openai_free_trial import OpenAIFreeTrial
from ..libs.llm.replicate import ReplicateLLM
from ..libs.llm.together import TogetherLLM


class ContinueSDK(BaseModel):
    pass


ALL_MODEL_ROLES = [
    "default",
    "summarize",
    "edit",
    "chat",
]

MODEL_CLASSES = {
    cls.__name__: cls
    for cls in [
        OpenAI,
        OpenAIFreeTrial,
        GGML,
        TogetherLLM,
        AnthropicLLM,
        ReplicateLLM,
        Ollama,
        LlamaCpp,
        HuggingFaceInferenceAPI,
        HuggingFaceTGI,
        GooglePaLMAPI,
    ]
}

MODEL_MODULE_NAMES = {
    "OpenAI": "openai",
    "OpenAIFreeTrial": "openai_free_trial",
    "GGML": "ggml",
    "TogetherLLM": "together",
    "AnthropicLLM": "anthropic",
    "ReplicateLLM": "replicate",
    "Ollama": "ollama",
    "LlamaCpp": "llamacpp",
    "HuggingFaceInferenceAPI": "hf_inference_api",
    "HuggingFaceTGI": "hf_tgi",
    "GooglePaLMAPI": "google_palm_api",
}


class Models(BaseModel):
    """Main class that holds the current model configuration"""

    default: LLM
    summarize: Optional[LLM] = None
    edit: Optional[LLM] = None
    chat: Optional[LLM] = None

    saved: List[LLM] = []

    # TODO namespace these away to not confuse readers,
    # or split Models into ModelsConfig, which gets turned into Models
    sdk: ContinueSDK = None

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("sdk", None)
        return original_dict

    @property
    def all_models(self):
        models = [getattr(self, role) for role in ALL_MODEL_ROLES]
        return [model for model in models if model is not None]

    @property
    def system_message(self) -> Optional[str]:
        if self.sdk:
            return self.sdk.config.system_message
        return None

    def set_system_message(self, msg: str):
        for model in self.all_models:
            if model.system_message is None:
                model.system_message = msg

    async def start(self, sdk: "ContinueSDK"):
        """Start each of the LLMs, or fall back to default"""
        self.sdk = sdk

        for role in ALL_MODEL_ROLES:
            model = getattr(self, role)
            if model is None:
                setattr(self, role, self.default)
            else:
                await sdk.start_model(model)

        self.set_system_message(self.system_message)

    async def stop(self, sdk: "ContinueSDK"):
        """Stop each LLM (if it's not the default, which is shared)"""
        for model in self.all_models:
            await model.stop()
