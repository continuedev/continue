from typing import Dict, List, Optional, Type

from pydantic import BaseModel, validator

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
    A pydantic class for the continue config file.
    """

    steps_on_startup: List[Step] = []
    disallowed_steps: Optional[List[str]] = []
    allow_anonymous_telemetry: Optional[bool] = True
    models: Models = Models(
        default=MaybeProxyOpenAI(model="gpt-4"),
        medium=MaybeProxyOpenAI(model="gpt-3.5-turbo"),
    )
    temperature: Optional[float] = 0.5
    custom_commands: Optional[List[CustomCommand]] = [
        CustomCommand(
            name="test",
            description="This is an example custom command. Use /config to edit it and create more",
            prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
        )
    ]
    slash_commands: Optional[List[SlashCommand]] = []
    on_traceback: Optional[Step] = None
    system_message: Optional[str] = None
    policy_override: Optional[Policy] = None
    context_providers: List[ContextProvider] = []
    user_token: Optional[str] = None
    data_server_url: Optional[str] = "https://us-west1-autodebug.cloudfunctions.net"

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
