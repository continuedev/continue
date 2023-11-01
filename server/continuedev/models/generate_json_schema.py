import os

from pydantic import schema_json_of

from ..core.config import ContinueConfig
from ..core.context import ContextItem, ContextItemId
from ..core.main import (
    SessionInfo,
    SessionState,
    SessionUpdate,
    ContinueError,
    SlashCommandDescription,
    ContextProviderDescription,
)
from ..core.models import Models
from ..libs.llm.base import LLM
from .filesystem import FileEdit, RangeInFile, RangeInFileWithContents
from .filesystem_edit import FileEditWithFullContents
from .main import Position, Range, Traceback, TracebackFrame
from ..server.sessions import PersistedSessionInfo

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


def main():
    clear_schemas()
    for model in MODELS_TO_GENERATE:
        title = RENAMES.get(model.__name__, model.__name__)
        try:
            json = schema_json_of(model, indent=2, title=title)
        except Exception as e:
            import traceback

            print(f"Failed to generate json schema for {title}: {e}")
            traceback.print_exc()
            continue  # pun intended

        with open(f"{SCHEMA_DIR}/{title}.json", "w") as f:
            f.write(json)


if __name__ == "__main__":
    main()
