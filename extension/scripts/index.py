import sys
import os
from typing import TextIO
from chroma import update_collection, query_collection, create_collection, collection_exists, get_current_branch
from typer import Typer

app = Typer()

class SilenceStdoutContextManager:
    saved_stdout: TextIO

    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout

silence = SilenceStdoutContextManager()

@app.command("exists")
def exists(cwd: str):
    with silence:
        exists = collection_exists(cwd)
    print({"exists": exists})

@app.command("create")
def create(cwd: str):
    with silence:
        branch = get_current_branch(cwd)
        create_collection(branch, cwd)
    print({"success": True})

@app.command("update")
def update(cwd: str):
    with silence:
        update_collection(cwd)
    print({"success": True})

@app.command("query")
def query(query: str, n_results: int, cwd: str):
    with silence:
        resp = query_collection(query, n_results, cwd)
    results = [{
        "id": resp["ids"][0][i],
        "document": resp["documents"][0][i]
    } for i in range(len(resp["ids"][0]))]
    print({"results": results})

if __name__ == "__main__":
    app()