from typing import Dict, Literal, Optional
from pydantic import BaseModel, Field

from ...libs.llm.prompts.chat import (
    llama2_template_messages,
    template_alpaca_messages,
    phind_template_messages,
    zephyr_template_messages,
    chatml_template_messages,
    anthropic_template_messages,
)

from ...libs.llm.prompts.edit import (
    codellama_edit_prompt,
    alpaca_edit_prompt,
    simplest_edit_prompt,
)  # TODO: Prompts for the rest of the template types


StepName = Literal[
    "AnswerQuestionChroma",
    "GenerateShellCommandStep",
    "EditHighlightedCodeStep",
    "ShareSessionStep",
    "CommentCodeStep",
    "ClearHistoryStep",
    "StackOverflowStep",
]

TemplateType = Literal["llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml"]


def autodetect_template_type(model: str) -> Optional[TemplateType]:
    lower = model.lower()
    if "gpt" in lower or "chat-bison" in lower:
        return None

    if "phind" in lower:
        return "phind"

    if "llama" in lower:
        return "llama2"

    if "zephyr" in lower:
        return "zephyr"

    if "claude" in lower:
        return "anthropic"

    if "alpaca" in lower or "wizard" in lower:
        return "alpaca"

    return "chatml"


def autodetect_template_function(model: str):
    template_type = autodetect_template_type(model)
    return {
        "llama2": llama2_template_messages,
        "alpaca": template_alpaca_messages,
        "phind": phind_template_messages,
        "zephyr": zephyr_template_messages,
        "anthropic": anthropic_template_messages,
        "chatml": chatml_template_messages,
    }[template_type]


def autodetect_prompt_templates(model: str):
    template_type = autodetect_template_type(model)

    templates = {}

    edit_template = None
    if template_type == "llama2":
        edit_template = codellama_edit_prompt
    elif template_type == "alpaca":
        edit_template = alpaca_edit_prompt
    elif template_type is not None:
        edit_template = simplest_edit_prompt

    if edit_template is not None:
        templates["edit"] = edit_template

    return templates


ModelProvider = Literal[
    "openai",
    "openai-free-trial",
    "openai-aiohttp",
    "anthropic",
    "together",
    "ollama",
    "huggingface-tgi",
    "huggingface-inference-api",
    "llama.cpp",
    "replicate",
    "text-gen-webui",
    "google-palm",
]

MODEL_PROVIDER_TO_MODEL_CLASS = {
    "openai": "OpenAI",
    "openai-free-trial": "OpenAIFreeTrial",
    "openai-aiohttp": "OpenAIFreeTrial",
    "anthropic": "AnthropicLLM",
    "together": "TogetherLLM",
    "ollama": "Ollama",
    "huggingface-tgi": "HuggingFaceTGI",
    "huggingface-inference-api": "HuggingFaceInferenceAPI",
    "llama.cpp": "LlamaCpp",
    "replicate": "ReplicateLLM",
    "text-gen-webui": "TextGenWebUI",
    "google-palm": "GooglePaLMAPI",
}


class RequestOptions(BaseModel):
    timeout: Optional[int] = Field(
        300,
        description="Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.",
    )
    verify_ssl: Optional[bool] = Field(
        None, description="Whether to verify SSL certificates for requests."
    )
    ca_bundle_path: str = Field(
        None,
        description="Path to a custom CA bundle to use when making the HTTP request",
    )
    proxy: Optional[str] = Field(
        None,
        description="Proxy URL to use when making the HTTP request",
    )
    headers: Optional[Dict[str, str]] = Field(
        None,
        description="Headers to use when making the HTTP request",
    )
