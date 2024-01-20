import os

from pydantic import schema_json_of

from continuedev.core.config import (
    ContinueConfig,
    ModelDescription,
    SerializedContinueConfig,
)
from continuedev.core.config_utils.shared import ModelName, ModelProvider
from continuedev.core.context import ContextItem, ContextItemId
from continuedev.core.main import (
    ContextProviderDescription,
    ContinueError,
    SessionInfo,
    SessionState,
    SessionUpdate,
    SlashCommandDescription,
)
from continuedev.core.models import Models
from continuedev.libs.llm.base import LLM
from continuedev.server.sessions import PersistedSessionInfo

from .filesystem import FileEdit, RangeInFile, RangeInFileWithContents
from .filesystem_edit import FileEditWithFullContents
from .main import Position, Range, Traceback, TracebackFrame

MODELS_TO_GENERATE = (
    [Position, Range, Traceback, TracebackFrame, RangeInFile, FileEdit, RangeInFileWithContents, FileEditWithFullContents, SessionInfo, SessionState, SessionUpdate, ContinueError, SlashCommandDescription, ContextProviderDescription, SerializedContinueConfig, ModelDescription, ModelProvider, ModelName, ContinueConfig, ContextItem, ContextItemId, Models, LLM, PersistedSessionInfo]
)

RENAMES = {"ExampleClass": "RenamedName"}

SCHEMA_DIR = "../schema/json"


def clear_schemas() -> None:
    for filename in os.listdir(SCHEMA_DIR):
        if filename.endswith(".json"):
            os.remove(os.path.join(SCHEMA_DIR, filename))


def main() -> None:
    clear_schemas()
    for model in MODELS_TO_GENERATE:
        title = RENAMES.get(model.__name__, model.__name__)
        if model == ModelProvider:
            title = "ModelProvider"
        elif model == ModelName:
            title = "ModelName"
        try:
            json = schema_json_of(model, indent=2, title=title)
        except Exception:
            import traceback

            traceback.print_exc()
            continue  # pun intended

        with open(f"{SCHEMA_DIR}/{title}.json", "w") as f:
            f.write(json)


if __name__ == "__main__":
    main()
