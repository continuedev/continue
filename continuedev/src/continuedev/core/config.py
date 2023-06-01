import json
import os
from pydantic import BaseModel
from typing import List, Optional, Dict
import yaml


class ContinueConfig(BaseModel):
    """
    A pydantic class for the continue config file.
    """
    steps_on_startup: Optional[Dict[str, Dict]] = {}
    server_url: Optional[str] = None


def load_config(config_file: str) -> ContinueConfig:
    """
    Load the config file and return a ContinueConfig object.
    """
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
