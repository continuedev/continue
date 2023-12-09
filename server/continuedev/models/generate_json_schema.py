import os

from pydantic import schema_json_of

from ..core.config import ContinueConfig, ModelDescription, SerializedContinueConfig
from ..core.config_utils.shared import ModelName, ModelNameWrapper, ModelProvider
from ..core.context import ContextItem, ContextItemId
from ..core.main import (
    ContextProviderDescription,
    ContinueError,
    SessionInfo,
    SessionState,
    SessionUpdate,
    SlashCommandDescription,
)
from ..core.models import Models
from ..libs.llm.base import LLM
from ..server.sessions import PersistedSessionInfo
from .filesystem import FileEdit, RangeInFile, RangeInFileWithContents
from .filesystem_edit import FileEditWithFullContents
from .main import Position, Range, Traceback, TracebackFrame

MODELS_TO_GENERATE = (
    [Position, Range, Traceback, TracebackFrame]
    + [RangeInFile, FileEdit, RangeInFileWithContents]
    + [FileEditWithFullContents]
    + [
        SessionInfo,
        SessionState,
        SessionUpdate,
        ContinueError,
        SlashCommandDescription,
        ContextProviderDescription,
    ]
    + [SerializedContinueConfig, ModelDescription]
    + [ModelNameWrapper]
    + [ContinueConfig]
    + [ContextItem, ContextItemId]
    + [Models]
    + [LLM]
    + [PersistedSessionInfo]    
)

RENAMES = {"ExampleClass": "RenamedName"}

SCHEMA_DIR = "../schema/json"


def clear_schemas():
    for filename in os.listdir(SCHEMA_DIR):
        if filename.endswith(".json"):
            os.remove(os.path.join(SCHEMA_DIR, filename))


from pydantic import TypeAdapter
from typing import List
import json

def main():
    clear_schemas()
    for model in MODELS_TO_GENERATE:
        title = RENAMES.get(model.__name__, model.__name__)
        if model == ModelProvider:
            title = "ModelProvider"
        elif model == ModelName:
            title = "ModelName"
        try:
            print(f"generating schema {title} - {model}")      
            with open(f"{SCHEMA_DIR}/{title}.json", "w") as f:
                f.write(json.dumps(model.model_json_schema(), indent=2))

        except Exception as e:
            import traceback

            print(f"Failed to generate json schema for model={model} name={__name__} title={title}: {e}")
            traceback.print_exc()
            continue  # pun intended

        

if __name__ == "__main__":
    main()
