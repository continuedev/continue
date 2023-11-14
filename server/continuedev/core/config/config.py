from typing import Dict, List, Optional, Type

from ...libs.llm.base import BaseCompletionOptions

from .serialized_config import (
    CustomCommand,
    RetrievalSettings,
    SerializedContinueConfig,
    SlashCommand,
)

from ...libs.util.edit_config import (
    create_bool_node,
    create_obj_node,
    display_llm_class,
    edit_config_property,
)
from ...libs.util.paths import convertConfigImports, getConfigFilePath

from pydantic import BaseModel, Field, validator

from ...libs.llm.openai_free_trial import OpenAIFreeTrial
from ..context import ContextProvider
from ..main import ContextProviderDescription, Policy, SlashCommandDescription, Step
from ..models import Models
from ...libs.util.telemetry import posthog_logger


class ContinueConfig(BaseModel):
    """
    Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` (`%userprofile%\.continue\config.py` for Windows) on your machine. This class is instantiated from the config file for every new session.
    """

    steps_on_startup: List[Step] = Field(
        [],
        description="Steps that will be automatically run at the beginning of a new session",
    )
    disallowed_steps: Optional[List[str]] = Field(
        [],
        description="Steps that are not allowed to be run, and will be skipped if attempted",
    )
    allow_anonymous_telemetry: Optional[bool] = Field(
        True,
        description="If this field is set to True, we will collect anonymous telemetry as described in the documentation page on telemetry. If set to False, we will not collect any data.",
    )
    models: Models = Field(
        Models(
            default=OpenAIFreeTrial(model="gpt-4"),
            summarize=OpenAIFreeTrial(model="gpt-3.5-turbo"),
        ),
        description="Configuration for the models used by Continue. Read more about how to configure models in the documentation.",
    )
    completion_options: BaseCompletionOptions = Field(
        BaseCompletionOptions(),
        description="Options for the completion endpoint. Read more about the completion options in the documentation.",
    )
    custom_commands: Optional[List[CustomCommand]] = Field(
        [
            CustomCommand(
                name="test",
                description="This is an example custom command. Use /config to edit it and create more",
                prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
            )
        ],
        description="An array of custom commands that allow you to reuse prompts. Each has name, description, and prompt properties. When you enter /<name> in the text input, it will act as a shortcut to the prompt.",
    )
    slash_commands: Optional[List[SlashCommand]] = Field(
        [],
        description="An array of slash commands that let you map custom Steps to a shortcut.",
    )
    on_traceback: Optional[Step] = Field(
        None,
        description="The step that will be run when a traceback is detected (when you use the shortcut cmd+shift+R)",
    )
    policy_override: Optional[Policy] = Field(
        None,
        description="A Policy object that can be used to override the default behavior of Continue, for example in order to build custom agents that take multiple steps at a time.",
    )
    context_providers: List[ContextProvider] = Field(
        [],
        description="A list of ContextProvider objects that can be used to provide context to the LLM by typing '@'. Read more about ContextProviders in the documentation.",
    )
    user_token: Optional[str] = Field(
        None, description="An optional token to identify the user."
    )
    data_server_url: Optional[str] = Field(
        "https://us-west1-autodebug.cloudfunctions.net",
        description="The URL of the server where development data is sent. No data is sent unless a valid user token is provided.",
    )
    disable_summaries: Optional[bool] = Field(
        False,
        description="If set to `True`, Continue will not generate summaries for each Step. This can be useful if you want to save on compute.",
    )
    disable_indexing: Optional[bool] = Field(
        False,
        description="If set to `True`, Continue will not index the codebase. This is mainly used for debugging purposes.",
    )
    retrieval_settings: Optional[RetrievalSettings] = Field(
        RetrievalSettings(),
        description="Settings for the retrieval system. Read more about the retrieval system in the documentation.",
    )

    @validator("temperature", pre=True)
    def temperature_validator(cls, v):
        return max(0.0, min(1.0, v))

    @staticmethod
    def from_serialized_config(config: SerializedContinueConfig) -> "ContinueConfig":
        return ContinueConfig(
            disallowed_steps=config.disallowed_steps,
            allow_anonymous_telemetry=config.allow_anonymous_telemetry,
            models=Models.from_serialized_config(config),
            completion_options=config.completion_options,
            custom_commands=config.custom_commands,
            slash_commands=config.slash_commands,
            context_providers=config.context_providers,
            user_token=config.user_token,
            data_server_url=config.data_server_url,
            disable_summaries=config.disable_summaries,
            disable_indexing=config.disable_indexing,
            retrieval_settings=config.retrieval_settings,
        )

    @staticmethod
    def from_filepath(filepath: str, retry: bool = True) -> "ContinueConfig":
        # Use importlib to load the config file config.py at the given path
        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location("config", filepath)
            config = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(config)

            return config.config
        except ModuleNotFoundError as e:
            # Check if the module was "continuedev.src"
            if retry and e.name == "continuedev.src":
                convertConfigImports(shorten=True)
                return ContinueConfig.from_filepath(filepath, retry=False)
            else:
                raise e

    @staticmethod
    def load_default() -> "ContinueConfig":
        path = getConfigFilePath()
        return ContinueConfig.from_filepath(path)

    def get_slash_command_descriptions(self) -> List[SlashCommandDescription]:
        custom_commands = (
            list(
                map(
                    lambda x: x.slash_command_description(),
                    self.custom_commands,
                )
            )
            or []
        )
        slash_commands = (
            list(
                map(
                    lambda x: x.slash_command_description(),
                    self.slash_commands,
                )
            )
            or []
        )
        cmds = custom_commands + slash_commands
        cmds.sort(key=lambda x: x.name == "edit", reverse=True)
        return cmds

    def get_context_provider_descriptions(self) -> List[ContextProviderDescription]:
        """
        Returns a list of ContextProviderDescriptions
        """
        return [
            provider.get_description()
            for provider in self.context_providers
            if provider.title != "code"  # Code isn't used with '@'
        ] + [
            ContextProviderDescription(
                title="file",
                display_title="Files",
                description="Reference files in the current workspace",
                dynamic=False,
                requires_query=False,
            )
        ]

    @staticmethod
    def set_temperature(temperature: float):
        edit_config_property(["temperature"], temperature)
        posthog_logger.capture_event("set_temperature", {"temperature": temperature})

    @staticmethod
    def set_system_message(message: str):
        edit_config_property(["system_message"], message)
        posthog_logger.capture_event("set_system_message", {"message": message})

    @staticmethod
    def set_models(models: Models, role: str):
        JOINER = ",\n\t\t"
        models_args = {
            "saved": f"[{JOINER.join([display_llm_class(llm) for llm in models.saved])}]",
            ("default" if role == "*" else role): display_llm_class(models.default),
        }
        edit_config_property(
            ["models"],
            create_obj_node("Models", models_args),
        )

    @staticmethod
    def set_telemetry_enabled(enabled: bool):
        edit_config_property(
            ["allow_anonymous_telemetry"],
            create_bool_node(enabled),
        )
