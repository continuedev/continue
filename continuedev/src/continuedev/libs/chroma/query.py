import json
import os
import subprocess
from functools import cached_property
from typing import List, Tuple

from llama_index import (
    Document,
    GPTVectorStoreIndex,
    StorageContext,
    load_index_from_storage,
)
from llama_index.langchain_helpers.text_splitter import TokenTextSplitter

from ..util.logging import logger
from .update import filter_ignored_files, load_gpt_index_documents


class ChromaIndexManager:
    workspace_dir: str

    def __init__(self, workspace_dir: str):
        self.workspace_dir = workspace_dir

    @cached_property
    def current_commit(self) -> str:
        """Get the current commit."""
        return (
            subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=self.workspace_dir
            )
            .decode("utf-8")
            .strip()
        )

    @cached_property
    def current_branch(self) -> str:
        """Get the current branch."""
        return (
            subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=self.workspace_dir
            )
            .decode("utf-8")
            .strip()
        )

    @cached_property
    def index_dir(self) -> str:
        return os.path.join(
            self.workspace_dir, ".continue", "chroma", self.current_branch
        )

    @cached_property
    def git_root_dir(self):
        """Get the root directory of a Git repository."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "--show-toplevel"], cwd=self.workspace_dir
                )
                .strip()
                .decode()
            )
        except subprocess.CalledProcessError:
            return None

    def check_index_exists(self):
        return os.path.exists(os.path.join(self.index_dir, "metadata.json"))

    def create_codebase_index(self):
        """Create a new index for the current branch."""
        if not self.check_index_exists():
            os.makedirs(self.index_dir)
        else:
            return

        documents = load_gpt_index_documents(self.workspace_dir)

        chunks = {}
        doc_chunks = []
        for doc in documents:
            text_splitter = TokenTextSplitter()
            try:
                text_chunks = text_splitter.split_text(doc.text)
            except:
                logger.warning(f"ERROR (probably found special token): {doc.text}")
                continue  # lol
            filename = doc.extra_info["filename"]
            chunks[filename] = len(text_chunks)
            for i, text in enumerate(text_chunks):
                doc_chunks.append(Document(text, doc_id=f"{filename}::{i}"))

        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump({"commit": self.current_commit, "chunks": chunks}, f, indent=4)

        index = GPTVectorStoreIndex([])

        for chunk in doc_chunks:
            index.insert(chunk)

        # d = 1536 # Dimension of text-ada-embedding-002
        # faiss_index = faiss.IndexFlatL2(d)
        # index = GPTFaissIndex(documents, faiss_index=faiss_index)
        # index.save_to_disk(f"{index_dir_for(branch)}/index.json", faiss_index_save_path=f"{index_dir_for(branch)}/index_faiss_core.index")

        index.storage_context.persist(persist_dir=self.index_dir)

        logger.debug("Codebase index created")

    def get_modified_deleted_files(self) -> Tuple[List[str], List[str]]:
        """Get a list of all files that have been modified since the last commit."""
        metadata = f"{self.index_dir}/metadata.json"
        with open(metadata, "r") as f:
            previous_commit = json.load(f)["commit"]

        modified_deleted_files = (
            subprocess.check_output(
                ["git", "diff", "--name-only", previous_commit, self.current_commit]
            )
            .decode("utf-8")
            .strip()
        )
        modified_deleted_files = modified_deleted_files.split("\n")
        modified_deleted_files = [f for f in modified_deleted_files if f]

        deleted_files = [
            f
            for f in modified_deleted_files
            if not os.path.exists(os.path.join(self.workspace_dir, f))
        ]
        modified_files = [
            f
            for f in modified_deleted_files
            if os.path.exists(os.path.join(self.workspace_dir, f))
        ]

        return filter_ignored_files(
            modified_files, self.index_dir
        ), filter_ignored_files(deleted_files, self.index_dir)

    def update_codebase_index(self):
        """Update the index with a list of files."""

        if not self.check_index_exists():
            self.create_codebase_index()
        else:
            # index = GPTFaissIndex.load_from_disk(f"{index_dir_for(branch)}/index.json", faiss_index_save_path=f"{index_dir_for(branch)}/index_faiss_core.index")
            index = GPTVectorStoreIndex.load_from_disk(f"{self.index_dir}/index.json")
            modified_files, deleted_files = self.get_modified_deleted_files()

            with open(f"{self.index_dir}/metadata.json", "r") as f:
                metadata = json.load(f)

            for file in deleted_files:
                num_chunks = metadata["chunks"][file]
                for i in range(num_chunks):
                    index.delete(f"{file}::{i}")

                del metadata["chunks"][file]

                logger.debug(f"Deleted {file}")

            for file in modified_files:
                if file in metadata["chunks"]:
                    num_chunks = metadata["chunks"][file]

                    for i in range(num_chunks):
                        index.delete(f"{file}::{i}")

                    logger.debug(f"Deleted old version of {file}")

                with open(file, "r") as f:
                    text = f.read()

                text_splitter = TokenTextSplitter()
                text_chunks = text_splitter.split_text(text)

                for i, text in enumerate(text_chunks):
                    index.insert(Document(text, doc_id=f"{file}::{i}"))

                metadata["chunks"][file] = len(text_chunks)

                logger.debug(f"Inserted new version of {file}")

            metadata["commit"] = self.current_commit

            with open(f"{self.index_dir}/metadata.json", "w") as f:
                json.dump(metadata, f, indent=4)

            logger.debug("Codebase index updated")

    def query_codebase_index(self, query: str) -> str:
        """Query the codebase index."""
        if not self.check_index_exists():
            logger.debug(f"No index found for the codebase at {self.index_dir}")
            return ""

        storage_context = StorageContext.from_defaults(persist_dir=self.index_dir)
        index = load_index_from_storage(storage_context)
        # index = GPTVectorStoreIndex.load_from_disk(path)
        engine = index.as_query_engine()
        return engine.query(query)

    def query_additional_index(self, query: str) -> str:
        """Query the additional index."""
        index = GPTVectorStoreIndex.load_from_disk(
            os.path.join(self.index_dir, "additional_index.json")
        )
        return index.query(query)

    def replace_additional_index(self, info: str):
        """Replace the additional index with the given info."""
        with open(f"{self.index_dir}/additional_context.txt", "w") as f:
            f.write(info)
        documents = [Document(info)]
        index = GPTVectorStoreIndex(documents)
        index.save_to_disk(f"{self.index_dir}/additional_index.json")
        logger.debug("Additional index replaced")
