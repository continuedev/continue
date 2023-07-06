from .main import *
from .filesystem import RangeInFile, FileEdit
from .filesystem_edit import FileEditWithFullContents
from ..core.main import History, HistoryNode, FullState
from pydantic import schema_json_of
import os

MODELS_TO_GENERATE = [
    Position, Range, Traceback, TracebackFrame
] + [
    RangeInFile, FileEdit
] + [
    FileEditWithFullContents
] + [
    History, HistoryNode, FullState
]

RENAMES = {
    "ExampleClass": "RenamedName"
}

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
            print(f"Failed to generate json schema for {title}: ", e)
            continue

        with open(f"{SCHEMA_DIR}/{title}.json", "w") as f:
            f.write(json)


if __name__ == "__main__":
    main()
