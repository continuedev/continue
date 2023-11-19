import asyncio
import json
import os
import re
import sqlite3
from functools import cached_property
from typing import Any, AsyncGenerator, Dict, List, Literal, Optional

import chromadb

# from chromadb.api import ClientAPI
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from openai.error import RateLimitError
from pydantic import BaseModel

from ...util.logging import logger
from ...util.paths import getEmbeddingsPathForBranch
from ..chunkers.chunk import Chunk
from ..git import GitProject
from .base import CodebaseIndex

load_dotenv()


# Mapping of workspace_dir to chromadb collection
collections = {}

EmbeddingsType = Literal["default", "openai"]

MAX_CHUNK_SIZE = 512


class CodebaseIndexMetadata(BaseModel):
    commit: str
    chunks: Dict[str, int]


class ChromaCodebaseIndex(CodebaseIndex):
    directory: str
    client: Any
    openai_api_key: Optional[str] = None
    api_base: Optional[str] = None
    api_version: Optional[str] = None
    api_type: Optional[str] = None
    organization_id: Optional[str] = None
    git_project: GitProject

    def __init__(
        self,
        directory: str,
        openai_api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        api_version: Optional[str] = None,
        api_type: Optional[str] = None,
        organization_id: Optional[str] = None,
    ):
        self.directory = directory
        self.git_project = GitProject(directory)
        self.openai_api_key = openai_api_key
        self.api_base = api_base
        self.api_version = api_version
        self.api_type = api_type
        self.organization_id = organization_id
        self.client = chromadb.PersistentClient(
            path=self.chroma_dir,
            settings=Settings(anonymized_telemetry=False),
        )

        os.environ.setdefault("TOKENIZERS_PARALLELISM", "true")

    @property
    def chroma_dir(self):
        return os.path.join(self.index_dir, "chroma")

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

    async def exists(self):
        """Check whether the codebase index has already been built and saved on disk"""
        return os.path.exists(self.metadata_path)

    def get_metadata(self) -> CodebaseIndexMetadata:
        return CodebaseIndexMetadata.parse_file(self.metadata_path)

    def convert_to_valid_chroma_collection(self, name: str) -> str:
        # https://docs.trychroma.com/usage-guide#creating-inspecting-and-deleting-collections

        # Truncate or pad name to correct length
        if len(name) < 3:
            name = name.ljust(3, "a")
        elif len(name) > 63:
            name = name[:63]

        # Ensure name starts and ends with a lowercase letter or digit
        if not re.match("^[a-z0-9]", name[0]):
            name = "a" + name[1:]
        if not re.match("[a-z0-9]$", name[-1]):
            name = name[:-1] + "a"

        # Replace invalid characters with 'a'
        name = re.sub("[^a-z0-9._-]", "a", name)

        # Replace consecutive dots with a single dot
        name = re.sub("\\.\\.+", ".", name)

        return name

    @property
    def collection(self):
        if self.directory in collections and os.path.exists(self.chroma_dir):
            return collections[self.directory]

        kwargs: Dict[str, Any] = {
            "name": self.convert_to_valid_chroma_collection(
                self.git_project.current_branch
            ),
        }
        if self.openai_api_key is not None:
            kwargs["embedding_function"] = embedding_functions.OpenAIEmbeddingFunction(
                api_key=self.openai_api_key,
                model_name="text-embedding-ada-002",
                api_base=self.api_base,
                api_version=self.api_version,
                api_type=self.api_type,
                organization_id=self.organization_id,
            )

        collection = self.client.get_or_create_collection(**kwargs)
        collections[self.directory] = collection
        return collection

    async def add_chunks(self, chunks: List[Chunk]):
        # Flatten chunks, metadata, and ids for insertion to Chroma
        documents = []
        metadatas = []
        ids = []

        for chunk in chunks:
            documents.append(chunk.content)
            metadatas.append(chunk.metadata)
            ids.append(chunk.id)

        # Embed the chunks and place into vector database
        # Attempt to avoid rate-limiting
        i = 0
        wait_time = 4.0
        while i < len(ids):
            try:
                if i > 0:
                    await asyncio.sleep(0.05)

                self.collection.add(
                    documents=documents[i : i + 100],
                    metadatas=metadatas[i : i + 100],
                    ids=ids[i : i + 100],
                )
                i += 100

            except RateLimitError as e:
                logger.debug(f"Rate limit exceeded, waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                wait_time *= 2
                if wait_time > 2**10:
                    raise e

            except sqlite3.OperationalError as e:
                logger.debug(f"SQL error: {e}")
                del collections[self.directory]

    async def build(
        self,
        chunks: AsyncGenerator[Chunk, None],
    ):
        """Create a new index for the current branch."""

        if await self.exists():
            return

        group = []
        group_size = 100
        async for chunk in chunks:
            if chunk.content.strip() == "":
                continue

            if len(group) < group_size:
                group.append(chunk)
                continue

            await self.add_chunks([chunk])

        if len(group) > 0:
            await self.add_chunks(group)

        # Metadata keeps track of number of chunks per file, used in update()
        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump(
                {
                    "commit": self.git_project.current_commit,
                    "chunks": {},  # TODO: This was removed, is it necessary?
                },
                f,
                indent=4,
            )

    async def update(self):
        """Update the index with a list of files."""

        if not await self.exists():
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

    async def query(self, query: str, n: int = 4) -> List[Chunk]:
        """Query the codebase index for top n results"""
        if not await self.exists():
            logger.warning(f"No index found for the codebase at {self.index_dir}")
            return []

        results = self.collection.query(query_texts=[query], n_results=n)

        chunks = []
        ids = results["ids"][0]
        metadatas = results["metadatas"][0]
        documents = results["documents"][0]
        for i in range(len(ids)):
            # Probably better to define some wrapper on Chroma or other VectorDB in general that is "Chunk in, Chunk out"
            other_metadata = metadatas[i]
            start_line = other_metadata.pop("start_line")
            end_line = other_metadata.pop("end_line")
            index = other_metadata.pop("index")
            document_id = other_metadata.pop("document_id")
            chunks.append(
                Chunk(
                    content=documents[i],
                    start_line=start_line,
                    end_line=end_line,
                    other_metadata=other_metadata,
                    document_id=document_id,
                    index=index,
                )
            )
        return chunks
