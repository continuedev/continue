from continuedev.src.continuedev.core.config import ContinueConfig
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.maybe_proxy_openai import MaybeProxyOpenAI

config = ContinueConfig(
    allow_anonymous_telemetry=False,
    models=Models(
        default=MaybeProxyOpenAI(api_key="", model="gpt-4"),
        medium=MaybeProxyOpenAI(
            api_key="",
            model="gpt-3.5-turbo",
        ),
    ),
    system_message=None,
    temperature=0.5,
    custom_commands=[],
    slash_commands=[],
    context_providers=[],
)
