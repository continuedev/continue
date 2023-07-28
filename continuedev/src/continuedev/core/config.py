import json
import os
from .main import Step
from .context import ContextProvider
from ..libs.llm.openai import OpenAI
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


class AzureInfo(BaseModel):
    endpoint: str
    engine: str
    api_version: str


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: List[Step] = []
    disallowed_steps: Optional[List[str]] = []
    allow_anonymous_telemetry: Optional[bool] = True
    llm: LLM = OpenAI(default_model="gpt-4")
    temperature: Optional[float] = 0.5
    custom_commands: Optional[List[CustomCommand]] = [CustomCommand(
        name="test",
        description="This is an example custom command. Use /config to edit it and create more",
        prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
    )]
    slash_commands: Optional[List[SlashCommand]] = []
    on_traceback: Optional[List[OnTracebackSteps]] = []
    system_message: Optional[str] = None

    context_providers: List[ContextProvider] = []

    # Want to force these to be the slash commands for now
    @validator('slash_commands', pre=True)
    def default_slash_commands_validator(cls, v):
        from ..plugins.steps.open_config import OpenConfigStep
        from ..plugins.steps.clear_history import ClearHistoryStep
        from ..plugins.steps.feedback import FeedbackStep
        from ..plugins.steps.comment_code import CommentCodeStep
        from ..plugins.steps.main import EditHighlightedCodeStep

        DEFAULT_SLASH_COMMANDS = [
            SlashCommand(
                name="edit",
                description="Edit code in the current file or the highlighted code",
                step=EditHighlightedCodeStep,
            ),
            SlashCommand(
                name="config",
                description="Open the config file to create new and edit existing slash commands",
                step=OpenConfigStep,
            ),
            SlashCommand(
                name="comment",
                description="Write comments for the current file or highlighted code",
                step=CommentCodeStep,
            ),
            SlashCommand(
                name="feedback",
                description="Send feedback to improve Continue",
                step=FeedbackStep,
            ),
            SlashCommand(
                name="clear",
                description="Clear step history",
                step=ClearHistoryStep,
            )
        ]

        return DEFAULT_SLASH_COMMANDS + v

    @validator('temperature', pre=True)
    def temperature_validator(cls, v):
        return max(0.0, min(1.0, v))
