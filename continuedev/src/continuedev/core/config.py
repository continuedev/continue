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


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: Optional[Dict[str, Dict]] = {}
    server_url: Optional[str] = None
    allow_anonymous_telemetry: Optional[bool] = True
    default_model: Literal["gpt-3.5-turbo", "gpt-4", "starcoder"]
    slash_commands: Optional[List[SlashCommand]] = [
        # SlashCommand(
        #     name="pytest",
        #     description="Write pytest unit tests for the current file",
        #     step_name="WritePytestsRecipe",
        #     params=??)

        SlashCommand(
            name="dlt",
            description="Create a dlt pipeline",
            step_name="CreatePipelineRecipe",
        ),
        SlashCommand(
            name="ddtobq",
            description="Create a dlt pipeline to load data from a data source into BigQuery",
            step_name="DDtoBQRecipe",
        ),
        SlashCommand(
            name="deployairflow",
            description="Deploy a dlt pipeline to Airflow",
            step_name="DeployPipelineAirflowRecipe",
        ),
        SlashCommand(
            name="comment",
            description="Write comments for the current file or highlighted code",
            step_name="CommentCodeStep",
        ),
        SlashCommand(
            name="pytest",
            description="Write pytest unit tests for the current file",
            step_name="WritePytestsRecipe",
        )
    ]


def load_config(config_file: str) -> ContinueConfig:
    """
    Load the config file and return a ContinueConfig object.
    """
    if not os.path.exists(config_file):
        return ContinueConfig()

    _, ext = os.path.splitext(config_file)
    if ext == '.yaml':
        with open(config_file, 'r') as f:
            config_dict = yaml.safe_load(f)
    elif ext == '.json':
        with open(config_file, 'r') as f:
            config_dict = json.load(f)
    else:
        raise ValueError(f'Unknown config file extension: {ext}')
    return ContinueConfig(**config_dict)
