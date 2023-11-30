import importlib.util
import json
import os
from contextlib import contextmanager
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, Union, cast

from pydantic import BaseModel, Field, validator

from ..libs.constants.default_config import default_config_json
from ..libs.llm.base import LLM
from ..libs.util.logging import logger
from ..libs.util.paths import getConfigFilePath, getGlobalFolderPath
from ..libs.util.telemetry import posthog_logger
from ..models.llm import BaseCompletionOptions, RequestOptions
from .config_utils.context import CONTEXT_PROVIDER_NAME_TO_CLASS, ContextProviderName
from .config_utils.shared import (
    MODEL_PROVIDER_TO_MODEL_CLASS,
    ModelProvider,
    StepName,
    TemplateType,
    autodetect_prompt_templates,
    autodetect_template_function,
)
from .context import ContextProvider
from .main import ContextProviderDescription, Policy, SlashCommandDescription, Step
from .models import MODEL_CLASSES, Models


class StepWithParams(BaseModel):
    name: StepName
    params: Dict[str, Any] = {}


class ContextProviderWithParams(BaseModel):
    name: ContextProviderName
    params: Dict[str, Any] = {}


class SlashCommand(BaseModel):
    name: str
    description: str
    step: Union[Type[Step], StepName, str]
    params: Optional[Dict] = {}

    # Allow step class for the migration
    @validator("step", pre=True, always=True)
    def step_is_string(cls, v):
        if isinstance(v, str):
            return v
        elif isinstance(v, object) and v.__class__.__name__ == "ModelMetaclass":
            return str(v).split(".")[-1].split("'")[0]
        else:
            return v

    def slash_command_description(self) -> SlashCommandDescription:
        return SlashCommandDescription(
            name=self.name,
            description=self.description,
        )


class CustomCommand(BaseModel):
    name: str
    prompt: str
    description: str

    def slash_command_description(self) -> SlashCommandDescription:
        return SlashCommandDescription(
            name=self.name,
            description=self.description,
        )


class RetrievalSettings(BaseModel):
    n_retrieve: Optional[int] = Field(
        default=50,
        description="Number of results to initially retrieve from vector database",
    )
    n_final: Optional[int] = Field(
        default=10, description="Final number of results to use after re-ranking"
    )
    use_reranking: bool = Field(
        default=True,
        description="Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results",
    )
    rerank_group_size: int = Field(
        default=5,
        description="Number of results to group together when re-ranking. Each group will be processed in parallel.",
    )
    ignore_files: List[str] = Field(
        default=[],
        description="Files to ignore when indexing the codebase. You can use glob patterns, such as **/*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.",
    )
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key")
    api_base: Optional[str] = Field(default=None, description="OpenAI API base URL")
    api_type: Optional[str] = Field(default=None, description="OpenAI API type")
    api_version: Optional[str] = Field(default=None, description="OpenAI API version")
    organization_id: Optional[str] = Field(
        default=None, description="OpenAI organization ID"
    )


class ModelDescription(BaseModel):
    class Config:
        extra = "allow"

    title: str = Field(
        default=...,
        description="The title you wish to give your model.",
    )

    provider: ModelProvider = Field(
        default=...,
        description="The provider of the model. This is used to determine the type of model, and how to interact with it.",
    )
    model: str = Field(
        default=...,
        description="The name of the model. Used to autodetect prompt template.",
    )
    api_key: Optional[str] = Field(
        default=None, description="OpenAI, Anthropic, Together, or other API key"
    )
    api_base: Optional[str] = Field(
        default=None, description="The base URL of the LLM API."
    )

    context_length: int = Field(
        default=2048,
        description="The maximum context length of the LLM in tokens, as counted by count_tokens.",
    )
    template: Optional[TemplateType] = Field(
        default=None,
        description="The chat template used to format messages. This is auto-detected for most models, but can be overridden here.",
    )
    completion_options: BaseCompletionOptions = Field(
        default=BaseCompletionOptions(),
        description="Options for the completion endpoint. Read more about the completion options in the documentation.",
    )
    system_message: Optional[str] = Field(
        default=None,
        description="A system message that will always be followed by the LLM",
    )

    request_options: RequestOptions = Field(
        default=RequestOptions(),
        description="Options for the HTTP request to the LLM.",
    )


class ModelRoles(BaseModel):
    default: str = Field(
        default=...,
        description="The default model. If other model roles are not set, they will fall back to default.",
    )
    chat: Optional[str] = Field(
        default=None,
        description="The model to use for chat. If not set, will fall back to default.",
    )
    edit: Optional[str] = Field(
        default=None,
        description="The model to use for editing. If not set, will fall back to default.",
    )
    summarize: Optional[str] = Field(
        default=None,
        description="The model to use for summarization. If not set, will fall back to default.",
    )


CONFIG_JSON_PATH = getConfigFilePath(json=True)


class SerializedContinueConfig(BaseModel):
    disallowed_steps: Optional[List[str]] = Field(
        default=[],
        description="Steps that are not allowed to be run, and will be skipped if attempted",
    )
    allow_anonymous_telemetry: Optional[bool] = Field(
        default=True,
        description="If this field is set to True, we will collect anonymous telemetry as described in the documentation page on telemetry. If set to False, we will not collect any data.",
    )
    models: List[ModelDescription] = Field(
        default=[
            ModelDescription(
                title="GPT-4 (trial)",
                provider="openai-free-trial",
                model="gpt-4",
                api_key="",
            )
        ]
    )
    model_roles: ModelRoles = Field(
        default=ModelRoles(default="GPT-4 (trial)"),
        description="Roles for models. Each entry should be the title of a model in the models array.",
    )
    system_message: Optional[str] = Field(
        default=None,
        description="A system message that will always be followed by the LLM",
    )
    completion_options: BaseCompletionOptions = Field(
        default=BaseCompletionOptions(),
        description="Default options for completion. These will be overriden by any options set for a specific model.",
    )
    slash_commands: Optional[List[SlashCommand]] = Field(
        default=[],
        description="An array of slash commands that let you map custom Steps to a shortcut.",
    )
    custom_commands: Optional[List[CustomCommand]] = Field(
        default=[
            CustomCommand(
                name="test",
                description="This is an example custom command. Use /config to edit it and create more",
                prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
            )
        ],
        description="An array of custom commands that allow you to reuse prompts. Each has name, description, and prompt properties. When you enter /<name> in the text input, it will act as a shortcut to the prompt.",
    )
    context_providers: List[ContextProviderWithParams] = Field(
        default=[],
        description="A list of ContextProvider objects that can be used to provide context to the LLM by typing '@'. Read more about ContextProviders in the documentation.",
    )
    user_token: Optional[str] = Field(
        default=None, description="An optional token to identify the user."
    )
    data_server_url: Optional[str] = Field(
        default="https://us-west1-autodebug.cloudfunctions.net",
        description="The URL of the server where development data is sent. No data is sent unless you have explicitly set the `user_token` property to a valid token that we have shared.",
    )
    disable_summaries: Optional[bool] = Field(
        default=False,
        description="If set to `True`, Continue will not generate summaries for each Step. This can be useful if you want to save on compute.",
    )
    disable_indexing: Optional[bool] = Field(
        default=False,
        description="If set to `True`, Continue will not index the codebase. This is mainly used for debugging purposes.",
    )
    retrieval_settings: Optional[RetrievalSettings] = Field(
        default=RetrievalSettings(),
        description="Settings for the retrieval system. Read more about the retrieval system in the documentation.",
    )

    @staticmethod
    @contextmanager
    def edit_config():
        config = SerializedContinueConfig.parse_file(CONFIG_JSON_PATH)
        yield config
        with open(CONFIG_JSON_PATH, "w") as f:
            f.write(config.json(exclude_none=True, exclude_defaults=True, indent=2))

    @staticmethod
    def set_temperature(temperature: float):
        with SerializedContinueConfig.edit_config() as config:
            config.completion_options.temperature = temperature

            posthog_logger.capture_event(
                "set_temperature", {"temperature": temperature}
            )

    @staticmethod
    def set_system_message(message: str):
        with SerializedContinueConfig.edit_config() as config:
            config.system_message = message

        posthog_logger.capture_event("set_system_message", {"message": message})

    @staticmethod
    def set_model_for_role(title: str, role: str):
        with SerializedContinueConfig.edit_config() as config:
            if role == "*":
                config.model_roles.default = title
                config.model_roles.chat = title
                config.model_roles.edit = title
                config.model_roles.summarize = title
            else:
                config.model_roles.__setattr__(role, title)

    @staticmethod
    def add_model(model: ModelDescription):
        with SerializedContinueConfig.edit_config() as config:
            config.models.append(model)

    @staticmethod
    def set_telemetry_enabled(enabled: bool):
        with SerializedContinueConfig.edit_config() as config:
            config.allow_anonymous_telemetry = enabled

    @staticmethod
    def delete_model(title: str):
        with SerializedContinueConfig.edit_config() as config:
            config.models = [model for model in config.models if model.title != title]
            if config.model_roles.default == title:
                config.model_roles.default = config.models[0].title
            if config.model_roles.chat == title:
                config.model_roles.chat = None
            if config.model_roles.edit == title:
                config.model_roles.edit = None
            if config.model_roles.summarize == title:
                config.model_roles.summarize = None


class ContinueConfig(BaseModel):
    """
    Continue can be deeply customized by editing the `ContinueConfig` object in `~/.continue/config.py` (`%userprofile%\\.continue\\config.py` for Windows) on your machine. This class is instantiated from the config file for every new session.
    """

    steps_on_startup: List[Step] = Field(
        default=[],
        description="Steps that will be automatically run at the beginning of a new session",
    )
    disallowed_steps: Optional[List[str]] = Field(
        default=[],
        description="Steps that are not allowed to be run, and will be skipped if attempted",
    )
    allow_anonymous_telemetry: bool = Field(
        default=True,
        description="If this field is set to True, we will collect anonymous telemetry as described in the documentation page on telemetry. If set to False, we will not collect any data.",
    )
    models: List[ModelDescription] = Field(
        default=[
            ModelDescription(
                title="GPT-4 (trial)",
                provider="openai-free-trial",
                model="gpt-4",
                api_key="",
            )
        ]
    )
    model_roles: ModelRoles = Field(
        default=ModelRoles(default="GPT-4 (trial)"),
        description="Roles for models. Each entry should be the title of a model in the models array.",
    )
    system_message: Optional[str] = Field(
        default=None,
        description="A system message that will always be followed by the LLM",
    )
    completion_options: BaseCompletionOptions = Field(
        default=BaseCompletionOptions(),
        description="Options for the completion endpoint. Read more about the completion options in the documentation.",
    )
    custom_commands: Optional[List[CustomCommand]] = Field(
        default=[
            CustomCommand(
                name="test",
                description="This is an example custom command. Use /config to edit it and create more",
                prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
            )
        ],
        description="An array of custom commands that allow you to reuse prompts. Each has name, description, and prompt properties. When you enter /<name> in the text input, it will act as a shortcut to the prompt.",
    )
    slash_commands: Optional[List[SlashCommand]] = Field(
        default=[],
        description="An array of slash commands that let you map custom Steps to a shortcut.",
    )
    on_traceback: Optional[Step] = Field(
        default=None,
        description="The step that will be run when a traceback is detected (when you use the shortcut cmd+shift+R)",
    )
    policy_override: Optional[Policy] = Field(
        default=None,
        description="A Policy object that can be used to override the default behavior of Continue, for example in order to build custom agents that take multiple steps at a time.",
    )
    context_providers: List[ContextProvider] = Field(
        default=[],
        description="A list of ContextProvider objects that can be used to provide context to the LLM by typing '@'. Read more about ContextProviders in the documentation.",
    )
    user_token: Optional[str] = Field(
        default=None, description="An optional token to identify the user."
    )
    data_server_url: Optional[str] = Field(
        default="https://us-west1-autodebug.cloudfunctions.net",
        description="The URL of the server where development data is sent. No data is sent unless you have explicitly set the `user_token` property to a valid token that we have shared.",
    )
    disable_summaries: Optional[bool] = Field(
        default=False,
        description="If set to `True`, Continue will not generate summaries for each Step. This can be useful if you want to save on compute.",
    )
    disable_indexing: bool = Field(
        default=False,
        description="If set to `True`, Continue will not index the codebase. This is mainly used for debugging purposes.",
    )
    retrieval_settings: Optional[RetrievalSettings] = Field(
        default=RetrievalSettings(),
        description="Settings for the retrieval system. Read more about the retrieval system in the documentation.",
    )

    @staticmethod
    def from_serialized_config(config: SerializedContinueConfig) -> "ContinueConfig":
        context_providers = [
            CONTEXT_PROVIDER_NAME_TO_CLASS[provider.name](**provider.params)
            for provider in config.context_providers
        ]
        return ContinueConfig(
            disallowed_steps=config.disallowed_steps,
            allow_anonymous_telemetry=config.allow_anonymous_telemetry
            if config.allow_anonymous_telemetry is not None
            else True,
            models=config.models,
            model_roles=config.model_roles,
            system_message=config.system_message,
            completion_options=config.completion_options,
            custom_commands=config.custom_commands,
            slash_commands=config.slash_commands,
            context_providers=context_providers,
            user_token=config.user_token,
            data_server_url=config.data_server_url,
            disable_summaries=config.disable_summaries,
            disable_indexing=config.disable_indexing or False,
            retrieval_settings=config.retrieval_settings,
        )

    @staticmethod
    def modifiers_from_filepath(
        filepath: str,
    ) -> Tuple[Optional[Callable], Optional[Callable]]:
        if not os.path.exists(filepath):
            return None, None

        try:
            if spec := importlib.util.spec_from_file_location("config", filepath):
                config = importlib.util.module_from_spec(spec)

                if spec.loader:
                    spec.loader.exec_module(config)

                    modify_config = None
                    modify_json = None
                    if hasattr(config, "modify_config"):
                        modify_config = config.modify_config

                    if hasattr(config, "modify_json"):
                        modify_json = config.modify_json

                    return modify_config, modify_json

        except Exception as e:
            logger.warning(f"Failed to load config modifier from {filepath}: {e}")
            return None, None

        return None, None

    @staticmethod
    def from_filepath(filepath: str, retry: bool = True) -> "ContinueConfig":
        if filepath.endswith(".json"):
            try:
                contents = open(filepath).read()
                if contents.strip() == "":
                    raise ValueError("Empty config file")

                serialized_config = json.loads(contents)

            except ValueError as e:
                logger.warning(f"Found empty config.json at {filepath}: {e}")
                with open(filepath, "w") as f:
                    f.write(default_config_json)

                serialized_config = json.load(open(filepath))

            serialized = SerializedContinueConfig(**serialized_config)

            modify_config, modify_json = ContinueConfig.modifiers_from_filepath(
                filepath[: -len(".json")] + ".py"
            )

            if modify_json:
                try:
                    serialized = modify_json(serialized)
                except Exception as e:
                    logger.warning(f"Failed to modify config: {e}")

            final_config = ContinueConfig.from_serialized_config(serialized)
            if modify_config:
                try:
                    final_config = modify_config(final_config)
                except Exception as e:
                    logger.warning(f"Failed to modify config: {e}")

            return final_config

        # Use importlib to load the config file config.py at the given path
        if spec := importlib.util.spec_from_file_location("config", filepath):
            config = importlib.util.module_from_spec(spec)
            if spec.loader:
                spec.loader.exec_module(config)

                return config.config

        raise Exception(f"Failed to load config from {filepath}")

    @staticmethod
    def load_default() -> "ContinueConfig":
        json_path = os.path.join(getGlobalFolderPath(), "config.json")
        if not os.path.exists(json_path):
            # MIGRATE FROM OLD CONFIG FORMAT TO JSON
            def move_config_to_old():
                old_path = py_path.replace(".py", ".py.old")
                if os.path.exists(old_path):
                    os.remove(old_path)
                os.rename(py_path, old_path)

            py_path = getConfigFilePath()
            try:
                # If they have pre-existing old config.py this will work
                config = ContinueConfig.from_filepath(py_path)
                if os.path.exists(json_path):
                    os.remove(json_path)

                with open(json_path, "w") as f:
                    json.dump(
                        config.to_serialized_continue_config().dict(
                            exclude_none=True, exclude_defaults=True
                        ),
                        f,
                        indent=2,
                    )

                # Rename config.py to config.old.py
                move_config_to_old()

                return config
            except Exception as e:
                logger.warning(f"Failed to load config from {py_path}: {e}")
                with open(json_path, "w") as f:
                    f.write(default_config_json)

                # Rename config.py to config.old.py
                move_config_to_old()

                return ContinueConfig.load_default()

        # The second time and thereafter, load from the json file
        config = ContinueConfig.from_filepath(json_path)
        return config

    def get_slash_command_descriptions(self) -> List[SlashCommandDescription]:
        custom_commands = (
            list(
                map(
                    lambda x: x.slash_command_description(),
                    self.custom_commands or [],
                )
            )
            or []
        )
        slash_commands = (
            list(
                map(
                    lambda x: x.slash_command_description(),
                    self.slash_commands or [],
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
                description="Type to search the workspace",
                dynamic=False,
                requires_query=False,
            )
        ]

    def to_serialized_continue_config(self) -> SerializedContinueConfig:
        # For migration purposes

        slash_commands = []
        for slash_command in self.slash_commands or []:
            if not isinstance(slash_command.step, str):
                slash_command.step = slash_command.step.__class__.__name__
            slash_commands.append(slash_command)

        return SerializedContinueConfig(
            disallowed_steps=self.disallowed_steps,
            allow_anonymous_telemetry=self.allow_anonymous_telemetry,
            models=self.models,
            model_roles=self.model_roles,
            system_message=self.system_message,
            completion_options=self.completion_options,
            custom_commands=self.custom_commands,
            slash_commands=slash_commands,
            context_providers=[
                ContextProviderWithParams(
                    name=cast(ContextProviderName, provider.title),
                    params=provider.dict(exclude_none=True, exclude_defaults=True),
                )
                for provider in self.context_providers
                if provider.title in CONTEXT_PROVIDER_NAME_TO_CLASS
            ],
            user_token=self.user_token,
            data_server_url=self.data_server_url,
            disable_summaries=self.disable_summaries,
            disable_indexing=self.disable_indexing,
            retrieval_settings=self.retrieval_settings,
        )

    def create_llm(self, model: ModelDescription) -> LLM:
        model_class = MODEL_CLASSES[MODEL_PROVIDER_TO_MODEL_CLASS[model.provider]]
        completion_options = self.completion_options.dict(
            exclude_none=True, exclude_defaults=True
        )
        completion_options.update(
            model.completion_options.dict(exclude_none=True, exclude_defaults=True)
        )

        if "max_tokens" not in completion_options:
            completion_options["max_tokens"] = min(2048, model.context_length // 2)

        # Allow extra fields to be passed through
        kwargs = {**model.dict(exclude_none=True)}
        kwargs["completion_options"] = completion_options
        kwargs["template_messages"] = autodetect_template_function(model.model)
        kwargs["prompt_templates"] = autodetect_prompt_templates(model.model)

        return model_class(**kwargs)

    def construct_models(self) -> Models:
        def model_with_title(title: Optional[str], fallback: ModelDescription):
            return next(filter(lambda x: x.title == title, self.models), fallback)

        default = model_with_title(self.model_roles.default, self.models[0])
        chat = model_with_title(self.model_roles.chat, default)
        edit = model_with_title(self.model_roles.edit, default)
        summarize = model_with_title(self.model_roles.summarize, default)

        saved = [
            model_with_title(model.title, default)
            for model in self.models
            if model.title
            not in [default.title, chat.title, edit.title, summarize.title]
        ]

        models = Models(
            default=self.create_llm(default),
            chat=self.create_llm(chat),
            edit=self.create_llm(edit),
            summarize=self.create_llm(summarize),
            saved=[self.create_llm(model) for model in saved],
        )
        return models
