import subprocess
import sys
from llama_index import GPTVectorStoreIndex, StorageContext, load_index_from_storage
import os
from typer import Typer
from enum import Enum
from .update import update_codebase_index, create_codebase_index, index_dir_for, get_current_branch
from .replace import replace_additional_index

app = Typer()


def query_codebase_index(query: str) -> str:
    """Query the codebase index."""
    branch = subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"]).decode("utf-8").strip()
    path = index_dir_for(branch)
    if not os.path.exists(path):
        print("No index found for the codebase at ", path)
        return ""

    storage_context = StorageContext.from_defaults(
        persist_dir=index_dir_for(branch))
    index = load_index_from_storage(storage_context)
    # index = GPTVectorStoreIndex.load_from_disk(path)
    engine = index.as_query_engine()
    return engine.query(query)


def query_additional_index(query: str) -> str:
    """Query the additional index."""
    index = GPTVectorStoreIndex.load_from_disk('data/additional_index.json')
    return index.query(query)


class IndexTypeOption(str, Enum):
    codebase = "codebase"
    additional = "additional"


@app.command()
def query(context: IndexTypeOption, query: str):
    if context == IndexTypeOption.additional:
        response = query_additional_index(query)
    elif context == IndexTypeOption.codebase:
        response = query_codebase_index(query)
    else:
        print("Error: unknown context")
    print({"response": response})


@app.command()
def check_index_exists(root_path: str):
    branch = get_current_branch()
    exists = os.path.exists(index_dir_for(branch))
    print({"exists": exists})


@app.command()
def update():
    update_codebase_index()
    print("Updated codebase index")


@app.command("create")
def create_index():
    create_codebase_index()
    print("Created file index")


@app.command()
def replace_additional_index(info: str):
    replace_additional_index()
    print("Replaced additional index")


if __name__ == '__main__':
    app()
