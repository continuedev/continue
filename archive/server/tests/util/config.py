from continuedev.core.config import ContinueConfig, ModelDescription

config = ContinueConfig(
    allow_anonymous_telemetry=False,
    models=[
        ModelDescription(model="gpt-4", title="GPT-4", provider="free-trial"),
        ModelDescription(
            model="gpt-3.5-turbo", title="GPT-3.5 Turbo", provider="free-trial"
        ),
    ],
    system_message=None,
    custom_commands=[],
    slash_commands=[],
    context_providers=[],
)
