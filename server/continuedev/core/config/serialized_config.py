from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from ...libs.util.paths import getConfigFilePath
from ...libs.util.telemetry import posthog_logger
from ...models.llm import BaseCompletionOptions, RequestOptions
from ..main import SlashCommandDescription
from .context import ContextProviderName
from .shared import ModelProvider, StepName, TemplateType


class StepWithParams(BaseModel):
    name: StepName
    params: Dict[str, Any] = {}


class ContextProviderWithParams(BaseModel):
    name: ContextProviderName
    params: Dict[str, Any] = {}


class SlashCommand(BaseModel):
    name: str
    description: str
    step: StepName
    params: Optional[Dict] = {}

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
    api_base: Optional[str] = Field(None, description="The base URL of the LLM API.")

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
            {
                "title": "GPT-4 (trial)",
                "provider": "openai-free-trial",
                "model": "gpt-4",
                "api_key": "",
            }
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
        description="The URL of the server where development data is sent. No data is sent unless a valid user token is provided.",
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

                if config.model_roles.chat is None:
                    config.model_roles.chat = title

                if config.model_roles.edit is None:
                    config.model_roles.edit = title

                if config.model_roles.summarize is None:
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
