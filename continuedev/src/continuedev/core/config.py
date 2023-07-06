import json
import os
from pydantic import BaseModel, validator
from typing import List, Literal, Optional, Dict
import yaml


class SlashCommand(BaseModel):
    name: str
    description: str
    step_name: str
    params: Optional[Dict] = {}


class CustomCommand(BaseModel):
    name: str
    prompt: str
    description: str


class OnTracebackSteps(BaseModel):
    step_name: str
    params: Optional[Dict] = {}


DEFAULT_SLASH_COMMANDS = [
    # SlashCommand(
    #     name="pytest",
    #     description="Write pytest unit tests for the current file",
    #     step_name="WritePytestsRecipe",
    #     params=??)
    SlashCommand(
        name="edit",
        description="Edit code in the current file or the highlighted code",
        step_name="EditHighlightedCodeStep",
    ),
    # SlashCommand(
    #     name="explain",
    #     description="Reply to instructions or a question with previous steps and the highlighted code or current file as context",
    #     step_name="SimpleChatStep",
    # ),
    SlashCommand(
        name="config",
        description="Open the config file to create new and edit existing slash commands",
        step_name="OpenConfigStep",
    ),
    SlashCommand(
        name="comment",
        description="Write comments for the current file or highlighted code",
        step_name="CommentCodeStep",
    ),
    SlashCommand(
        name="feedback",
        description="Send feedback to improve Continue",
        step_name="FeedbackStep",
    ),
    SlashCommand(
        name="clear",
        description="Clear step history",
        step_name="ClearHistoryStep",
    )
]


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: Optional[Dict[str, Dict]] = {}
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
    slash_commands: Optional[List[SlashCommand]] = DEFAULT_SLASH_COMMANDS
    on_traceback: Optional[List[OnTracebackSteps]] = [
        OnTracebackSteps(step_name="DefaultOnTracebackStep")]

    # Want to force these to be the slash commands for now
    @validator('slash_commands', pre=True)
    def default_slash_commands_validator(cls, v):
        return DEFAULT_SLASH_COMMANDS


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
