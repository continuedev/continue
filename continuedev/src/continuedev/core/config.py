from typing import Dict, List, Optional, Type

from pydantic import BaseModel, Field, validator

from ..libs.llm.maybe_proxy_openai import MaybeProxyOpenAI
from .context import ContextProvider
from .main import Policy, Step
from .models import Models


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


class CustomCommand(BaseModel):
    name: str
    prompt: str
    description: str


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
            default=MaybeProxyOpenAI(model="gpt-4"),
            medium=MaybeProxyOpenAI(model="gpt-3.5-turbo"),
        ),
        description="Configuration for the models used by Continue. Read more about how to configure models in the documentation.",
    )
    temperature: Optional[float] = Field(
        0.5,
        description="The temperature parameter for sampling from the LLM. Higher temperatures will result in more random output, while lower temperatures will result in more predictable output. This value ranges from 0 to 1.",
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
    system_message: Optional[str] = Field(
        None, description="A system message that will always be followed by the LLM"
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

    @validator("temperature", pre=True)
    def temperature_validator(cls, v):
        return max(0.0, min(1.0, v))

    @staticmethod
    def from_filepath(filepath: str) -> "ContinueConfig":
        # Use importlib to load the config file config.py at the given path
        import importlib.util

        spec = importlib.util.spec_from_file_location("config", filepath)
        config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config)

        return config.config
