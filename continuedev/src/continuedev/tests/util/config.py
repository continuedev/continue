from continuedev.src.continuedev.core.config import ContinueConfig
from continuedev.src.continuedev.core.models import Models
from continuedev.src.continuedev.libs.llm.openai_free_trial import OpenAIFreeTrial

config = ContinueConfig(
    allow_anonymous_telemetry=False,
    models=Models(
        default=OpenAIFreeTrial(api_key="", model="gpt-4"),
        summarize=OpenAIFreeTrial(
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
