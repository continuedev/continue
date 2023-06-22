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


class OnTracebackSteps(BaseModel):
    step_name: str
    params: Optional[Dict] = {}


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
    slash_commands: Optional[List[SlashCommand]] = [
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
        SlashCommand(
            name="explain",
            description="Reply to instructions or a question with previous steps and the highlighted code or current file as context",
            step_name="SimpleChatStep",
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
    on_traceback: Optional[List[OnTracebackSteps]] = [
        OnTracebackSteps(step_name="DefaultOnTracebackStep")]


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

def update_config(config_file: str):
    """
    Update the config file with the current ContinueConfig object.
    """
    if not os.path.exists(config_file):
        with open(config_file, 'w') as f:
            config_dict = { "default_model": "gpt-3.5-turbo" }
            json.dump(config_dict, f, indent=4)

    _, ext = os.path.splitext(config_file)
    if ext == '.yaml':

        with open(config_file, 'w') as f:
            config_dict = yaml.safe_load(f)

            if config_dict["default_model"] == "gpt-4":
                config_dict["default_model"] = "gpt-3.5-turbo"
            else:
                config_dict["default_model"] = "gpt-4"
            
            with open(config_file, 'w') as f:
                json.dump(config_dict, f, indent=4)

    elif ext == '.json':
        with open(config_file, 'r') as f:
            config_dict = json.load(f)

        if config_dict["default_model"] == "gpt-4":
            config_dict["default_model"] = "gpt-3.5-turbo"
        else:
            config_dict["default_model"] = "gpt-4"
        
        with open(config_file, 'w') as f:
            json.dump(config_dict, f, indent=4)