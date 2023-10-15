import asyncio
import json
import os
from urllib.parse import quote_plus
from functools import cached_property
from typing import AsyncGenerator, Dict, List, Literal, Optional, Tuple

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from ...libs.index.git import GitProject
from dotenv import load_dotenv
from openai.error import RateLimitError
from pydantic import BaseModel

from ...core.sdk import ContinueSDK
from ..util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path
from ..util.logging import logger
from ..util.paths import getEmbeddingsPathForBranch

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


def chunk_document(document: Optional[str], max_length: int = 1000) -> List[str]:
    """Chunk a document into smaller pieces."""
    if document is None:
        return []

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

EmbeddingsType = Literal["default", "openai"]


class CodebaseIndexMetadata(BaseModel):
    commit: str
    chunks: Dict[str, int]


class ChromaCodebaseIndex:
    directory: str
    client: chromadb.Client
    openai_api_key: str = None
    git_project: GitProject

    def __init__(
        self,
        directory: str,
        openai_api_key: str = None,
    ):
        self.directory = directory
        self.git_project = GitProject(directory)
        self.openai_api_key = openai_api_key
        self.client = chromadb.PersistentClient(
            path=os.path.join(self.index_dir, "chroma"),
            settings=Settings(anonymized_telemetry=False),
        )
        collections[self.directory] = self.collection
        os.environ.setdefault("TOKENIZERS_PARALLELISM", "true")

    @property
    def embeddings_type(self) -> EmbeddingsType:
        return "default" if self.openai_api_key is None else "openai"

    @cached_property
    def index_dir(self) -> str:
        directory = os.path.join(
            getEmbeddingsPathForBranch(self.directory, self.git_project.current_branch),
            self.embeddings_type,
        )
        os.makedirs(directory, exist_ok=True)
        return directory

    @property
    def index_name(self) -> str:
        return (
            f"{self.directory}/{self.git_project.current_branch}/{self.embeddings_type}"
        )

    @cached_property
    def metadata_path(self) -> str:
        return os.path.join(self.index_dir, "metadata.json")

    def exists(self):
        """Check whether the codebase index has already been built and saved on disk"""
        return os.path.exists(self.metadata_path)

    def get_metadata(self) -> CodebaseIndexMetadata:
        return CodebaseIndexMetadata.parse_file(self.metadata_path)

    @property
    def collection(self):
        if self.directory in collections:
            return collections[self.directory]

        kwargs = {
            "name": quote_plus(self.git_project.current_branch).replace("%", ""),
        }
        if self.openai_api_key is not None:
            kwargs["embedding_function"] = embedding_functions.OpenAIEmbeddingFunction(
                api_key=self.openai_api_key,
                model_name="text-embedding-ada-002",
            )

        return self.client.get_or_create_collection(**kwargs)

    async def build(
        self, sdk: ContinueSDK, ignore_files: List[str] = []
    ) -> AsyncGenerator[float, None]:
        """Create a new index for the current branch."""

        if self.exists():
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

        async def readFile(filepath: str) -> Optional[str]:
            to = 0.1
            while True:
                try:
                    return await sdk.ide.readFile(filepath)
                except Exception as e:
                    if to > 4:
                        return None
                    await asyncio.sleep(to)
                    to *= 2

        for file in files:
            tasks.append(readFile(file))

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

                # Give a progress update (1.0 is completed)
                yield i / len(flattened_chunks)
            except RateLimitError as e:
                logger.debug(f"Rate limit exceeded, waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                wait_time *= 2
                if wait_time > 2**10:
                    raise e

        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump(
                {
                    "commit": self.git_project.current_commit,
                    "chunks": {files[i]: len(chunks[i]) for i in range(len(files))},
                },
                f,
                indent=4,
            )

        logger.debug("Codebase index created")

    async def update(self):
        """Update the index with a list of files."""

        if not self.exists():
            self.build()
        else:
            metadata = self.get_metadata()
            (
                modified_files,
                deleted_files,
            ) = self.git_project.get_modified_deleted_files(metadata.commit)

            for file in deleted_files:
                num_chunks = metadata.chunks[file]
                for i in range(num_chunks):
                    self.collection.delete(file)

                del metadata.chunks[file]

                logger.debug(f"Deleted {file}")

            for file in modified_files:
                if file in metadata.chunks:
                    num_chunks = metadata.chunks[file]

                    for i in range(num_chunks):
                        self.collection.delete(file)

                    logger.debug(f"Deleted old version of {file}")

                with open(file, "r") as f:
                    f.read()

                # for i, text in enumerate(text_chunks):
                #     index.insert(Document(text=text, doc_id=f"{file}::{i}"))

                # metadata.chunks[file] = len(text_chunks)

                logger.debug(f"Inserted new version of {file}")

            metadata.commit = self.git_project.current_commit

            with open(self.metadata_path, "w") as f:
                f.write(metadata.json())

            logger.debug("Codebase index updated")

    def query(self, query: str, n: int = 4) -> str:
        """Query the codebase index for top n results"""
        if not self.exists():
            logger.warning(f"No index found for the codebase at {self.index_dir}")
            return []

        return self.collection.query(query_texts=[query], n_results=n)
