import json
import os
from .main import Step
from .context import ContextProvider
from pydantic import BaseModel, validator
from typing import List, Literal, Optional, Dict, Type, Union
import yaml


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


class OpenAIServerInfo(BaseModel):
    api_base: Optional[str] = None
    engine: Optional[str] = None
    api_version: Optional[str] = None
    api_type: Literal["azure", "openai"] = "openai"


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: List[Step] = []
    disallowed_steps: Optional[List[str]] = []
    allow_anonymous_telemetry: Optional[bool] = True
    default_model: Literal["gpt-3.5-turbo", "gpt-3.5-turbo-16k",
                           "gpt-4", "claude-2", "ggml"] = 'gpt-4'
    temperature: Optional[float] = 0.5
    custom_commands: Optional[List[CustomCommand]] = [CustomCommand(
        name="test",
        description="This is an example custom command. Use /config to edit it and create more",
        prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
    )]
    slash_commands: Optional[List[SlashCommand]] = []
    on_traceback: Optional[List[OnTracebackSteps]] = []
    system_message: Optional[str] = None
    openai_server_info: Optional[OpenAIServerInfo] = None

    context_providers: List[ContextProvider] = []

    @validator('temperature', pre=True)
    def temperature_validator(cls, v):
        return max(0.0, min(1.0, v))
