import json
import os
from .main import Step
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


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: List[Step] = []
    disallowed_steps: Optional[List[str]] = []
    server_url: Optional[str] = None
    allow_anonymous_telemetry: Optional[bool] = True
    default_model: Literal["gpt-3.5-turbo", "gpt-3.5-turbo-16k",
                           "gpt-4"] = 'gpt-4'
    custom_commands: Optional[List[CustomCommand]] = [CustomCommand(
        name="test",
        description="This is an example custom command. Use /config to edit it and create more",
        prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
    )]
    slash_commands: Optional[List[SlashCommand]] = []
    on_traceback: Optional[List[OnTracebackSteps]] = []

    # Want to force these to be the slash commands for now
    @validator('slash_commands', pre=True)
    def default_slash_commands_validator(cls, v):
        from ..steps.core.core import UserInputStep
        from ..steps.open_config import OpenConfigStep
        from ..steps.clear_history import ClearHistoryStep
        from ..steps.on_traceback import DefaultOnTracebackStep
        from ..recipes.DeployPipelineAirflowRecipe.main import DeployPipelineAirflowRecipe
        from ..recipes.DDtoBQRecipe.main import DDtoBQRecipe
        from ..recipes.CreatePipelineRecipe.main import CreatePipelineRecipe
        from ..recipes.AddTransformRecipe.main import AddTransformRecipe
        from ..steps.feedback import FeedbackStep
        from ..steps.comment_code import CommentCodeStep
        from ..steps.chat import SimpleChatStep
        from ..steps.main import EditHighlightedCodeStep

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


def load_config(config_file: str) -> ContinueConfig:
    """
    Load the config file and return a ContinueConfig object.
    """
    if not os.path.exists(config_file):
        return ContinueConfig()

    _, ext = os.path.splitext(config_file)
    if ext == '.yaml':
        with open(config_file, 'r') as f:
            try:
                config_dict = yaml.safe_load(f)
            except:
                return ContinueConfig()
    elif ext == '.json':
        with open(config_file, 'r') as f:
            try:
                config_dict = json.load(f)
            except:
                return ContinueConfig()
    else:
        raise ValueError(f'Unknown config file extension: {ext}')
    return ContinueConfig(**config_dict)


def load_global_config() -> ContinueConfig:
    """
    Load the global config file and return a ContinueConfig object.
    """
    global_dir = os.path.expanduser('~/.continue')
    if not os.path.exists(global_dir):
        os.mkdir(global_dir)

    yaml_path = os.path.join(global_dir, 'config.yaml')
    if os.path.exists(yaml_path):
        with open(config_path, 'r') as f:
            try:
                config_dict = yaml.safe_load(f)
            except:
                return ContinueConfig()
    else:
        config_path = os.path.join(global_dir, 'config.json')
        if not os.path.exists(config_path):
            with open(config_path, 'w') as f:
                json.dump(ContinueConfig().dict(), f)
        with open(config_path, 'r') as f:
            try:
                config_dict = json.load(f)
            except:
                return ContinueConfig()
    return ContinueConfig(**config_dict)


def update_global_config(config: ContinueConfig):
    """
    Update the config file with the given ContinueConfig object.
    """
    global_dir = os.path.expanduser('~/.continue')
    if not os.path.exists(global_dir):
        os.mkdir(global_dir)

    yaml_path = os.path.join(global_dir, 'config.yaml')
    if os.path.exists(yaml_path):
        with open(config_path, 'w') as f:
            yaml.dump(config.dict(), f)
    else:
        config_path = os.path.join(global_dir, 'config.json')
        with open(config_path, 'w') as f:
            json.dump(config.dict(exclude_unset=False), f, indent=4)
