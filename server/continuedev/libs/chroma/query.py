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
from openai.error import RateLimitError

from ...core.sdk import ContinueSDK
from ..util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path
from ..util.logging import logger
from ..util.paths import getEmbeddingsPathForBranch
from .update import filter_ignored_files

load_dotenv()

IGNORE_PATTERNS_FOR_CHROMA = [
    # File Names
    "**/.DS_Store",
    "**/package-lock.json",
    "**/yarn.lock",
    # File Types
    "*.log",
    "*.ttf",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.mp4",
    "*.svg",
    "*.ico",
    "*.pdf",
    "*.zip",
    "*.gz",
    "*.tar",
    "*.tgz",
    "*.rar",
    "*.7z",
    "*.exe",
    "*.dll",
    "*.obj",
    "*.o",
    "*.a",
    "*.lib",
    "*.so",
    "*.dylib",
    "*.ncb",
    "*.sdf",
]


def chunk_document(document: str, max_length: int = 1000) -> List[str]:
    """Chunk a document into smaller pieces."""
    chunks = []
    chunk = ""
    for line in document.split("\n"):
        if len(chunk) + len(line) > max_length:
            chunks.append(chunk)
            chunk = ""
        chunk += line + "\n"
    chunks.append(chunk)
    return chunks


# Mapping of workspace_dir to chromadb collection
collections = {}


class ChromaIndexManager:
    workspace_dir: str
    client: chromadb.Client
    openai_api_key: str = None

    def __init__(
        self,
        workspace_dir: str,
        openai_api_key: str = None,
    ):
        self.workspace_dir = workspace_dir
        self.client = chromadb.PersistentClient(
            path=os.path.join(
                getEmbeddingsPathForBranch(self.workspace_dir, self.current_branch),
                "chroma",
            ),
            settings=Settings(anonymized_telemetry=False),
        )
        self.openai_api_key = openai_api_key
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "true")

    @cached_property
    def current_commit(self) -> str:
        """Get the current commit."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "HEAD"], cwd=self.workspace_dir
                )
                .decode("utf-8")
                .strip()
            )
        except subprocess.CalledProcessError:
            return "NONE"

    @cached_property
    def current_branch(self) -> str:
        """Get the current branch."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=self.workspace_dir
                )
                .decode("utf-8")
                .strip()
            )
        except subprocess.CalledProcessError:
            return "NONE"

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
        if self.workspace_dir in collections:
            return collections[self.workspace_dir]

        kwargs = {
            "name": self.current_branch,
        }
        if (
            self.openai_api_key is not None
        ):
            kwargs["embedding_function"] = embedding_functions.OpenAIEmbeddingFunction(
                api_key=self.openai_api_key,
                model_name="text-embedding-ada-002",
            )

        return self.client.get_or_create_collection(**kwargs)

    async def create_codebase_index(
        self, sdk: ContinueSDK, ignore_files: List[str] = []
    ):
        """Create a new index for the current branch."""
        collections[self.workspace_dir] = self.collection

        if self.check_index_exists():
            return

        files = await sdk.ide.listDirectoryContents(sdk.ide.workspace_directory, True)

        # Filter from ignore_directories
        files = list(
            filter(
                lambda file: not should_filter_path(
                    file,
                    ignore_files + DEFAULT_IGNORE_PATTERNS + IGNORE_PATTERNS_FOR_CHROMA,
                ),
                files,
            )
        )

        tasks = []
        for file in files:
            tasks.append(sdk.ide.readFile(file))

        documents = await asyncio.gather(*tasks)

        chunks = [chunk_document(document) for document in documents]

        flattened_chunks = []
        flattened_metadata = []
        flattened_ids = []
        for i in range(len(chunks)):
            for j in range(len(chunks[i])):
                flattened_chunks.append(chunks[i][j])
                flattened_metadata.append({"filepath": files[i]})
                flattened_ids.append(f"{files[i]}::{j}")

        for i in range(len(flattened_chunks)):
            if len(flattened_chunks[i]) == 0:
                flattened_chunks[i] = "EMPTY"
            elif len(flattened_chunks[i]) > 6000:
                flattened_chunks[i] = flattened_chunks[i][:6000]

        # Attempt to avoid rate-limiting
        i = 0
        wait_time = 4.0
        while i < len(flattened_chunks):
            try:
                self.collection.add(
                    documents=flattened_chunks[i : i + 100],
                    metadatas=flattened_metadata[i : i + 100],
                    ids=flattened_ids[i : i + 100],
                )
                i += 100
                await asyncio.sleep(0.5)
            except RateLimitError as e:
                logger.debug(f"Rate limit exceeded, waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                wait_time *= 2
                if wait_time > 2**10:
                    raise e

        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump(
                {
                    "commit": self.current_commit,
                    "chunks": {files[i]: len(chunks[i]) for i in range(len(files))},
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

        try:
            modified_deleted_files = (
                subprocess.check_output(
                    ["git", "diff", "--name-only", previous_commit, self.current_commit]
                )
                .decode("utf-8")
                .strip()
            )
        except subprocess.CalledProcessError:
            return [], []

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
            return []

        results = self.collection.query(query_texts=[query], n_results=n)

        return results
