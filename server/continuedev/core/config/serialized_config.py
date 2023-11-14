from typing import Any, Dict, List, Literal, Optional, Type
from .shared import ModelProvider, RequestOptions, StepName, TemplateType
from pydantic import BaseModel, Field

from ...libs.llm.base import BaseCompletionOptions
from ..main import SlashCommandDescription, Step


class StepWithParams(BaseModel):
    step: StepName
    params: Dict[str, Any]


class SlashCommand(BaseModel):
    name: str
    description: str
    step: Type[Step]
    params: Optional[Dict] = {}

    def dict(self, *args, **kwargs):
        return {
            "name": self.name,
            "description": self.description,
            "params": self.params,
            "step": self.step.__name__,
        }

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
        50, description="Number of results to initially retrieve from vector database"
    )
    n_final: Optional[int] = Field(
        10, description="Final number of results to use after re-ranking"
    )
    use_reranking: bool = Field(
        True,
        description="Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results",
    )
    rerank_group_size: int = Field(
        5,
        description="Number of results to group together when re-ranking. Each group will be processed in parallel.",
    )
    ignore_files: List[str] = Field(
        [],
        description="Files to ignore when indexing the codebase. You can use glob patterns, such as **/*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.",
    )
    openai_api_key: Optional[str] = Field(None, description="OpenAI API key")
    api_base: Optional[str] = Field(None, description="OpenAI API base URL")
    api_type: Optional[str] = Field(None, description="OpenAI API type")
    api_version: Optional[str] = Field(None, description="OpenAI API version")
    organization_id: Optional[str] = Field(None, description="OpenAI organization ID")


class ModelDescription(BaseModel):
    title: str = Field(
        ...,
        description="The title you wish to give your model.",
    )

    provider: ModelProvider = Field(
        ...,
        description="The provider of the model. This is used to determine the type of model, and how to interact with it.",
    )
    model: str = Field(
        ...,
        description="The name of the model. Used to autodetect prompt template.",
    )
    api_key: Optional[str] = Field(
        None, description="OpenAI, Anthropic, Together, or other API key"
    )
    api_base: Optional[str] = Field(None, description="The base URL of the LLM API.")

    context_length: int = Field(
        2048,
        description="The maximum context length of the LLM in tokens, as counted by count_tokens.",
    )
    template: Optional[TemplateType] = Field(
        None,
        description="The chat template used to format messages. This is auto-detected for most models, but can be overridden here.",
    )
    completion_options: BaseCompletionOptions = Field(
        BaseCompletionOptions(),
        description="Options for the completion endpoint. Read more about the completion options in the documentation.",
    )
    system_message: Optional[str] = Field(
        None,
        description="A system message that will always be followed by the LLM",
    )

    request_options: RequestOptions = Field(
        RequestOptions(),
        description="Options for the HTTP request to the LLM.",
    )


class ModelRoles(BaseModel):
    default: str = Field(
        ...,
        description="The default model. If other model roles are not set, they will fall back to default.",
    )
    chat: Optional[str] = Field(
        None,
        description="The model to use for chat. If not set, will fall back to default.",
    )
    edit: Optional[str] = Field(
        None,
        description="The model to use for editing. If not set, will fall back to default.",
    )
    summarize: Optional[str] = Field(
        None,
        description="The model to use for summarization. If not set, will fall back to default.",
    )


class SerializedContinueConfig(BaseModel):
    disallowed_steps: Optional[List[str]] = Field(
        [],
        description="Steps that are not allowed to be run, and will be skipped if attempted",
    )
    allow_anonymous_telemetry: Optional[bool] = Field(
        True,
        description="If this field is set to True, we will collect anonymous telemetry as described in the documentation page on telemetry. If set to False, we will not collect any data.",
    )
    models: List[ModelDescription] = Field(
        [
            {
                "title": "GPT-4 (trial)",
                "provider": "openai-free-trial",
                "model": "gpt-4",
                "api_key": "",
            }
        ]
    )
    model_roles: ModelRoles = Field(
        ModelRoles(default="GPT-4 (trial)"),
        description="Roles for models. Each entry should be the title of a model in the models array.",
    )
    completion_options: BaseCompletionOptions = Field(
        BaseCompletionOptions(),
        description="Default options for completion. These will be overriden by any options set for a specific model.",
    )
    slash_commands: Optional[List[SlashCommand]] = Field(
        [],
        description="An array of slash commands that let you map custom Steps to a shortcut.",
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
    context_providers: List[StepWithParams] = Field(
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
