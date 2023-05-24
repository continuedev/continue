import chromadb
import os
import json
import subprocess

from typing import List, Tuple

from chromadb.config import Settings

client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./data/"
))

FILE_TYPES_TO_IGNORE = [
    '.pyc',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico'
]

def further_filter(files: List[str], root_dir: str):
    """Further filter files before indexing."""
    for file in files:
        if file.endswith(tuple(FILE_TYPES_TO_IGNORE)) or file.startswith('.git') or file.startswith('archive'):
            continue
        yield root_dir + "/" + file

def get_git_root_dir(path: str):
    """Get the root directory of a Git repository."""
    try:
        return subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=path).strip().decode()
    except subprocess.CalledProcessError:
        return None

def get_git_ignored_files(root_dir: str):
    """Get the list of ignored files in a Git repository."""
    try:
        output = subprocess.check_output(['git', 'ls-files', '--ignored', '--others', '--exclude-standard'], cwd=root_dir).strip().decode()
        return output.split('\n')
    except subprocess.CalledProcessError:
        return []

def get_all_files(root_dir: str):
    """Get a list of all files in a directory."""
    for dir_path, _, file_names in os.walk(root_dir):
        for file_name in file_names:
            yield os.path.join(os.path.relpath(dir_path, root_dir), file_name)

def get_input_files(root_dir: str):
    """Get a list of all files in a Git repository that are not ignored."""
    ignored_files = set(get_git_ignored_files(root_dir))
    all_files = set(get_all_files(root_dir))
    nonignored_files = all_files - ignored_files
    return further_filter(nonignored_files, root_dir)

def get_git_root_dir(cwd: str):
    """Get the root directory of a Git repository."""
    result = subprocess.run(['git', 'rev-parse', '--show-toplevel'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
    return result.stdout.decode().strip()

def get_current_branch(cwd: str) -> str:
    """Get the current Git branch."""
    try:
        return subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd).decode("utf-8").strip()
    except:
        return "main"

def get_current_commit(cwd: str) -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=cwd).decode("utf-8").strip()
    except:
        return "NO_COMMITS"

def get_modified_deleted_files(cwd: str) -> Tuple[List[str], List[str]]:
    """Get a list of all files that have been modified since the last commit."""
    branch = get_current_branch(cwd)
    current_commit = get_current_commit(cwd)

    with open(f"./data/{branch}.json", 'r') as f:
        previous_commit = json.load(f)["commit"]

    modified_deleted_files = subprocess.check_output(["git", "diff", "--name-only", previous_commit, current_commit], cwd=cwd).decode("utf-8").strip()
    modified_deleted_files = modified_deleted_files.split("\n")
    modified_deleted_files = [f for f in modified_deleted_files if f]

    root = get_git_root_dir(cwd)
    deleted_files = [f for f in modified_deleted_files if not os.path.exists(root + "/" + f)]
    modified_files = [f for f in modified_deleted_files if os.path.exists(root + "/" +  f)]

    return further_filter(modified_files, root), further_filter(deleted_files, root)

def create_collection(branch: str, cwd: str):
    """Create a new collection, returning whether it already existed."""
    try:
        collection = client.create_collection(name=branch)
    except Exception as e:
        print(e)
        return

    files = get_input_files(get_git_root_dir(cwd))
    for file in files:
        with open(file, 'r') as f:
            collection.add(documents=[f.read()], ids=[file])
        print(f"Added {file}")
    with open(f"./data/{branch}.json", 'w') as f:
        json.dump({"commit": get_current_commit(cwd)}, f)

def collection_exists(cwd: str):
    """Check if a collection exists."""
    branch = get_current_branch(cwd)
    return branch in client.list_collections()

def update_collection(cwd: str):
    """Update the collection."""
    branch = get_current_branch(cwd)

    try:

        collection = client.get_collection(branch)
        
        modified_files, deleted_files = get_modified_deleted_files(cwd)

        for file in deleted_files:
            collection.delete(ids=[file])
            print(f"Deleted {file}")
        
        for file in modified_files:
            with open(file, 'r') as f:
                collection.update(documents=[f.read()], ids=[file])
            print(f"Updated {file}")
        
        with open(f"./data/{branch}.json", 'w') as f:
            json.dump({"commit": get_current_commit(cwd)}, f)

    except:

        create_collection(branch, cwd)

def query_collection(query: str, n_results: int, cwd: str):
    """Query the collection."""
    branch = get_current_branch(cwd)
    try:
        collection = client.get_collection(branch)
    except:
        create_collection(branch, cwd)
        collection = client.get_collection(branch)
    results = collection.query(query_texts=[query], n_results=n_results)
    return results