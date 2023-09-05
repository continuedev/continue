import os

from pydantic import schema_json_of

from ..core.config import ContinueConfig
from ..core.context import ContextItem
from ..core.main import FullState, History, HistoryNode, SessionInfo
from ..core.models import Models
from ..libs.llm import LLM
from .filesystem import FileEdit, RangeInFile
from .filesystem_edit import FileEditWithFullContents
from .main import Position, Range, Traceback, TracebackFrame

MODELS_TO_GENERATE = (
    [Position, Range, Traceback, TracebackFrame]
    + [RangeInFile, FileEdit]
    + [FileEditWithFullContents]
    + [History, HistoryNode, FullState, SessionInfo]
    + [ContinueConfig]
    + [ContextItem]
    + [Models]
    + [LLM]
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
