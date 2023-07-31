import json
import os
from .main import Step
from .context import ContextProvider
from ..libs.llm.maybe_proxy_openai import MaybeProxyOpenAI
from .models import Models
from pydantic import BaseModel, validator
from typing import List, Literal, Optional, Dict, Type

from .main import Policy, Step
from .context import ContextProvider


class SlashCommand(BaseModel):
    name: str
    description: str
    step: Type[Step]
    params: Optional[Dict] = {}


class CustomCommand(BaseModel):
    name: str
    prompt: str
    description: str


class OnTracebackSteps(BaseModel):
    step: Type[Step]
    params: Optional[Dict] = {}


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: List[Step] = []
    disallowed_steps: Optional[List[str]] = []
    allow_anonymous_telemetry: Optional[bool] = True
    models: Models = Models(
        default=MaybeProxyOpenAI(model="gpt-4"),
    )
    temperature: Optional[float] = 0.5
    custom_commands: Optional[List[CustomCommand]] = [CustomCommand(
        name="test",
        description="This is an example custom command. Use /config to edit it and create more",
        prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
    )]
    slash_commands: Optional[List[SlashCommand]] = []
    on_traceback: Optional[List[OnTracebackSteps]] = []
    system_message: Optional[str] = None
    policy_override: Optional[Policy] = None

    context_providers: List[ContextProvider] = []

    @validator('temperature', pre=True)
    def temperature_validator(cls, v):
        return max(0.0, min(1.0, v))
