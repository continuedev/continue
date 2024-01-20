import uuid
from typing import Any, Callable, Dict, List, Optional, Type, Union

from pydantic import BaseModel, validator

from ..libs.llm.anthropic import AnthropicLLM
from ..libs.llm.base import LLM
from ..libs.llm.ggml import GGML
from ..libs.llm.google_palm_api import GooglePaLMAPI
from ..libs.llm.hf_inference_api import HuggingFaceInferenceAPI
from ..libs.llm.hf_tgi import HuggingFaceTGI
from ..libs.llm.llamacpp import LlamaCpp
from ..libs.llm.llamafile import Llamafile
from ..libs.llm.lmstudio import LMStudio
from ..libs.llm.ollama import Ollama
from ..libs.llm.openai import OpenAI
from ..libs.llm.openai_free_trial import OpenAIFreeTrial
from ..libs.llm.replicate import ReplicateLLM
from ..libs.llm.text_gen_webui import TextGenWebUI
from ..libs.llm.together import TogetherLLM


class ContinueSDK(BaseModel):
    pass


ALL_MODEL_ROLES = [
    "default",
    "summarize",
    "edit",
    "chat",
]

MODEL_CLASSES: Dict[str, Type[LLM]] = {
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
        TextGenWebUI,
        LMStudio,
        Llamafile,
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
    "TextGenWebUI": "text_gen_webui",
    "LMStudio": "lmstudio",
    "Llamafile": "llamafile",
}


class Models(BaseModel):
    """Main class that holds the current model configuration."""

    default: Union[Any, LLM]
    summarize: Union[Any, LLM]
    edit: Union[Any, LLM]
    chat: Union[Any, LLM]

    saved: List[Union[Any, LLM]] = []

    temperature: Optional[float] = None
    system_message: Optional[str] = None

    @validator(
        "summarize",
        "edit",
        "chat",
        pre=True,
        always=True,
    )
    def roles_not_none(cls, v, values):
        if v is None:
            return values["default"]
        return v

    def dict(self, **kwargs):
        return super().dict(**kwargs)

    @property
    def all_models(self) -> List[LLM]:
        models = [getattr(self, role) for role in ALL_MODEL_ROLES]
        return [model for model in models if model is not None]

    def set_main_config_params(
        self, system_msg: Optional[str], temperature: Optional[float],
    ) -> None:
        self.system_message = system_msg
        self.temperature = temperature
        for model in self.all_models:
            model.set_main_config_params(system_msg, temperature)

    def start(
        self,
        unique_id: str,
        system_message: Optional[str],
        temperature: Optional[float],
        llm_request_hook: Optional[Callable[[str, str], Any]] = None,
    ) -> None:
        """Start each of the LLMs, or fall back to default."""
        for model in self.saved + self.all_models:
            model.start(unique_id)
            model.write_log = self.write_log
            model.llm_request_hook = llm_request_hook

        self.set_main_config_params(system_message, temperature)

    async def stop(self) -> None:
        """Stop each LLM (if it's not the default, which is shared)."""
        for model in self.all_models:
            await model.stop()

    _loggers = {}

    async def write_log(self, msg) -> None:
        for logger in self._loggers.values():
            await logger(msg)

    def add_logger(self, logger: Callable[[str], Any]) -> str:
        logger_id = uuid.uuid4().hex
        self._loggers[logger_id] = logger
        return logger_id

    def remove_logger(self, logger_id: str) -> None:
        if logger_id in self._loggers:
            del self._loggers[logger_id]
