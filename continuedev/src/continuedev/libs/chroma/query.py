import asyncio
import json
import os
import subprocess
from functools import cached_property
from typing import List, Tuple

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

from ...core.sdk import ContinueSDK
from ..util.logging import logger
from ..util.paths import getEmbeddingsPathForBranch
from .update import filter_ignored_files

load_dotenv()


class ChromaIndexManager:
    workspace_dir: str
    client: chromadb.Client
    openai_api_key: str

    def __init__(self, workspace_dir: str, openai_api_key: str = None):
        self.workspace_dir = workspace_dir
        self.client = chromadb.PersistentClient(
            path=os.path.join(
                getEmbeddingsPathForBranch(self.workspace_dir, self.current_branch),
                "chroma",
            ),
            settings=Settings(anonymized_telemetry=False),
        )
        self.openai_api_key = openai_api_key

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
        return getEmbeddingsPathForBranch(self.workspace_dir, self.current_branch)

    @property
    def index_name(self) -> str:
        return f"{self.workspace_dir}/{self.current_branch}"

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

    @property
    def collection(self):
        kwargs = {
            "name": self.current_branch,
        }
        if self.openai_api_key is not None:
            kwargs["embedding_function"] = embedding_functions.OpenAIEmbeddingFunction(
                api_key=self.openai_api_key,
                model_name="text-embedding-ada-002",
            )
        return self.client.get_or_create_collection(**kwargs)

    async def create_codebase_index(self, sdk: ContinueSDK):
        """Create a new index for the current branch."""
        if self.check_index_exists():
            return

        files = await sdk.ide.listDirectoryContents(sdk.ide.workspace_directory, True)

        tasks = []
        for file in files:
            tasks.append(sdk.ide.readFile(file))

        documents = await asyncio.gather(*tasks)

        for i in range(len(documents)):
            if len(documents[i]) > 6000:
                documents[i] = documents[i][:6000]
            elif len(documents[i]) == 0:
                documents[i] = "EMPTY"

        self.collection.add(
            documents=documents,
            metadatas=[{"filepath": file} for file in files],
            ids=files,
        )

        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump(
                {
                    "commit": self.current_commit,
                    "chunks": {
                        file: 1
                        for file in files  # This is the number of chunks per file
                    },
                },
                f,
                indent=4,
            )

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
            modified_files, deleted_files = self.get_modified_deleted_files()

            with open(f"{self.index_dir}/metadata.json", "r") as f:
                metadata = json.load(f)

            for file in deleted_files:
                num_chunks = metadata["chunks"][file]
                for i in range(num_chunks):
                    self.collection.delete(file)

                del metadata["chunks"][file]

                logger.debug(f"Deleted {file}")

            for file in modified_files:
                if file in metadata["chunks"]:
                    num_chunks = metadata["chunks"][file]

                    for i in range(num_chunks):
                        self.collection.delete(file)

                    logger.debug(f"Deleted old version of {file}")

                with open(file, "r") as f:
                    f.read()

                # for i, text in enumerate(text_chunks):
                #     index.insert(Document(text=text, doc_id=f"{file}::{i}"))

                # metadata["chunks"][file] = len(text_chunks)

                logger.debug(f"Inserted new version of {file}")

            metadata["commit"] = self.current_commit

            with open(f"{self.index_dir}/metadata.json", "w") as f:
                json.dump(metadata, f, indent=4)

            logger.debug("Codebase index updated")

    def query_codebase_index(self, query: str, n: int = 4) -> str:
        """Query the codebase index."""
        if not self.check_index_exists():
            logger.debug(f"No index found for the codebase at {self.index_dir}")
            return ""

        results = self.collection.query(query_texts=[query], n_results=n)

        return results
