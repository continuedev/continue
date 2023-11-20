from typing import Any, Dict, Literal, Optional

from ...libs.llm.prompts.chat import (
    anthropic_template_messages,
    chatml_template_messages,
    deepseek_template_messages,
    llama2_template_messages,
    phind_template_messages,
    template_alpaca_messages,
    zephyr_template_messages,
)
from ...libs.llm.prompts.edit import (
    alpaca_edit_prompt,
    codellama_edit_prompt,
    deepseek_edit_prompt,
    phind_edit_prompt,
    simplest_edit_prompt,
    zephyr_edit_prompt,
)

StepName = Literal[
    "AnswerQuestionChroma",
    "GenerateShellCommandStep",
    "EditHighlightedCodeStep",
    "ShareSessionStep",
    "CommentCodeStep",
    "ClearHistoryStep",
    "StackOverflowStep",
    "OpenConfigStep",
    "GenerateShellCommandStep",
]

TemplateType = Literal[
    "llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml", "deepseek"
]


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

    if "mistral" in lower:
        return "llama2"

    if "deepseek" in lower:
        return "deepseek"

    return "chatml"


def autodetect_template_function(model: str):
    if template_type := autodetect_template_type(model):
        mapping: Dict[TemplateType, Any] = {
            "llama2": llama2_template_messages,
            "alpaca": template_alpaca_messages,
            "phind": phind_template_messages,
            "zephyr": zephyr_template_messages,
            "anthropic": anthropic_template_messages,
            "chatml": chatml_template_messages,
            "deepseek": deepseek_template_messages,
        }
        return mapping[template_type]
    return None


def autodetect_prompt_templates(model: str):
    template_type = autodetect_template_type(model)

    templates = {}

    edit_template = None
    if template_type == "phind":
        edit_template = phind_edit_prompt
    elif template_type == "zephyr":
        edit_template = zephyr_edit_prompt
    elif template_type == "llama2":
        edit_template = codellama_edit_prompt
    elif template_type == "alpaca":
        edit_template = alpaca_edit_prompt
    elif template_type == "deepseek":
        edit_template = deepseek_edit_prompt
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
    "lmstudio",
]

MODEL_PROVIDER_TO_MODEL_CLASS = {
    "openai": "OpenAI",
    "openai-free-trial": "OpenAIFreeTrial",
    "openai-aiohttp": "GGML",
    "anthropic": "AnthropicLLM",
    "together": "TogetherLLM",
    "ollama": "Ollama",
    "huggingface-tgi": "HuggingFaceTGI",
    "huggingface-inference-api": "HuggingFaceInferenceAPI",
    "llama.cpp": "LlamaCpp",
    "replicate": "ReplicateLLM",
    "text-gen-webui": "TextGenWebUI",
    "google-palm": "GooglePaLMAPI",
    "lmstudio": "LMStudio",
}

MODEL_CLASS_TO_MODEL_PROVIDER: Dict[str, ModelProvider] = {
    "OpenAI": "openai",
    "OpenAIFreeTrial": "openai-free-trial",
    "AnthropicLLM": "anthropic",
    "TogetherLLM": "together",
    "Ollama": "ollama",
    "HuggingFaceTGI": "huggingface-tgi",
    "HuggingFaceInferenceAPI": "huggingface-inference-api",
    "LlamaCpp": "llama.cpp",
    "ReplicateLLM": "replicate",
    "TextGenWebUI": "text-gen-webui",
    "GooglePaLMAPI": "google-palm",
    "LMStudio": "lmstudio",
}

MODELS = [
    # OpenAI
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
    "gpt-4-1106-preview",
    # Open-Source
    "mistral-7b",
    "llama2-7b",
    "llama2-13b",
    "codellama-7b",
    "codellama-13b",
    "codellama-34b",
    "phind-codellama-34b",
    "wizardcoder-7b",
    "wizardcoder-13b",
    "wizardcoder-34b",
    "zephyr-7b",
    "codeup-13b",
    "deepseek-1b",
    "deepseek-7b",
    "deepseek-33b",
    # Anthropic
    "claude-2",
    # Google PaLM
    "chat-bison-001",
]

ModelName = Literal[
    # OpenAI
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
    "gpt-4-1106-preview",
    # Open-Source
    "mistral-7b",
    "llama2-7b",
    "llama2-13b",
    "codellama-7b",
    "codellama-13b",
    "codellama-34b",
    "phind-codellama-34b",
    "wizardcoder-7b",
    "wizardcoder-13b",
    "wizardcoder-34b",
    "zephyr-7b",
    "codeup-13b",
    "deepseek-1b",
    "deepseek-7b",
    "deepseek-33b",
    # Anthropic
    "claude-2",
    # Google PaLM
    "chat-bison-001",
]
