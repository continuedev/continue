# import faiss
import json
import os
import subprocess

from gpt_index.langchain_helpers.text_splitter import TokenTextSplitter
from gpt_index import GPTSimpleVectorIndex, SimpleDirectoryReader, Document, GPTFaissIndex
from typing import List, Generator, Tuple

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

def load_gpt_index_documents(root: str) -> List[Document]:
    """Loads a list of GPTIndex Documents, respecting .gitignore files."""
    # Get input files
    input_files = get_input_files(root)
    # Use SimpleDirectoryReader to load the files into Documents
    return SimpleDirectoryReader(root, input_files=input_files, file_metadata=lambda filename: {"filename": filename}).load_data()

def index_dir_for(branch: str) -> str:
    return f"data/{branch}"

def get_git_root_dir():
    result = subprocess.run(['git', 'rev-parse', '--show-toplevel'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.stdout.decode().strip()

def get_current_branch() -> str:
    return subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"]).decode("utf-8").strip()

def get_current_commit() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"]).decode("utf-8").strip()

def create_codebase_index():
    """Create a new index for the current branch."""
    branch = get_current_branch()
    if not os.path.exists(index_dir_for(branch)):
        os.makedirs(index_dir_for(branch))

    documents = load_gpt_index_documents(get_git_root_dir())
    
    chunks = {}
    doc_chunks = []
    for doc in documents:
        text_splitter = TokenTextSplitter()
        text_chunks = text_splitter.split_text(doc.text)
        filename = doc.extra_info["filename"]
        chunks[filename] = len(text_chunks)
        for i, text in enumerate(text_chunks):
            doc_chunks.append(Document(text, doc_id=f"{filename}::{i}"))

    with open(f"{index_dir_for(branch)}/metadata.json", "w") as f:
        json.dump({"commit": get_current_commit(), "chunks" : chunks}, f, indent=4)

    index = GPTSimpleVectorIndex([])
    for chunk in doc_chunks:
        index.insert(chunk)

    # d = 1536 # Dimension of text-ada-embedding-002
    # faiss_index = faiss.IndexFlatL2(d)
    # index = GPTFaissIndex(documents, faiss_index=faiss_index)
    # index.save_to_disk(f"{index_dir_for(branch)}/index.json", faiss_index_save_path=f"{index_dir_for(branch)}/index_faiss_core.index")

    index.save_to_disk(f"{index_dir_for(branch)}/index.json")

    print("Codebase index created")

def get_modified_deleted_files() -> Tuple[List[str], List[str]]:
    """Get a list of all files that have been modified since the last commit."""
    branch = get_current_branch()
    current_commit = get_current_commit()

    metadata = f"{index_dir_for(branch)}/metadata.json"
    with open(metadata, "r") as f:
        previous_commit = json.load(f)["commit"]

    modified_deleted_files = subprocess.check_output(["git", "diff", "--name-only", previous_commit, current_commit]).decode("utf-8").strip()
    modified_deleted_files = modified_deleted_files.split("\n")
    modified_deleted_files = [f for f in modified_deleted_files if f]

    root = get_git_root_dir()
    deleted_files = [f for f in modified_deleted_files if not os.path.exists(root + "/" + f)]
    modified_files = [f for f in modified_deleted_files if os.path.exists(root + "/" +  f)]

    return further_filter(modified_files, index_dir_for(branch)), further_filter(deleted_files, index_dir_for(branch))

def update_codebase_index():
    """Update the index with a list of files."""
    branch = get_current_branch()

    if not os.path.exists(index_dir_for(branch)):
        create_codebase_index()
    else:
        # index = GPTFaissIndex.load_from_disk(f"{index_dir_for(branch)}/index.json", faiss_index_save_path=f"{index_dir_for(branch)}/index_faiss_core.index")
        index = GPTSimpleVectorIndex.load_from_disk(f"{index_dir_for(branch)}/index.json")
        modified_files, deleted_files = get_modified_deleted_files()

        with open(f"{index_dir_for(branch)}/metadata.json", "r") as f:
            metadata = json.load(f)

        for file in deleted_files:
            
            num_chunks = metadata["chunks"][file]
            for i in range(num_chunks):
                index.delete(f"{file}::{i}")

            del metadata["chunks"][file]

            print(f"Deleted {file}")

        for file in modified_files:

            if file in metadata["chunks"]:

                num_chunks = metadata["chunks"][file]

                for i in range(num_chunks):
                    index.delete(f"{file}::{i}")

                print(f"Deleted old version of {file}")

            with open(file, "r") as f:
                text = f.read()

            text_splitter = TokenTextSplitter()
            text_chunks = text_splitter.split_text(text)
            
            for i, text in enumerate(text_chunks):
                index.insert(Document(text, doc_id=f"{file}::{i}"))
            
            metadata["chunks"][file] = len(text_chunks)

            print(f"Inserted new version of {file}")        

        metadata["commit"] = get_current_commit()

        with open(f"{index_dir_for(branch)}/metadata.json", "w") as f:
            json.dump(metadata, f, indent=4)
        
        print("Codebase index updated")

if __name__ == "__main__":
    """python3 update.py"""
    update_codebase_index()