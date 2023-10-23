import asyncio

import json
import os
import re
from functools import cached_property
from typing import AsyncGenerator, Dict, List, Literal, Optional
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from openai.error import RateLimitError
from pydantic import BaseModel

from .chunkers.chunk import Chunk
from ...libs.index.git import GitProject
from ...core.sdk import ContinueSDK
from ..util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path
from ..util.logging import logger
from ..util.paths import getEmbeddingsPathForBranch
from .chunkers import chunk_document

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


# Mapping of workspace_dir to chromadb collection
collections = {}

EmbeddingsType = Literal["default", "openai"]

MAX_CHUNK_SIZE = 512


class CodebaseIndexMetadata(BaseModel):
    commit: str
    chunks: Dict[str, int]


class ChromaCodebaseIndex:
    directory: str
    client: chromadb.Client
    openai_api_key: str = None
    api_base: str = None
    api_version: str = None
    api_type: str = None
    organization_id: str = None
    git_project: GitProject

    def __init__(
        self,
        directory: str,
        openai_api_key: str = None,
        api_base: str = None,
        api_version: str = None,
        api_type: str = None,
        organization_id: str = None,
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

    def exists(self):
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
        name = re.sub("\.\.+", ".", name)

        return name

    @property
    def collection(self):
        if self.directory in collections and os.path.exists(self.chroma_dir):
            return collections[self.directory]

        kwargs = {
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

    async def build(
        self, sdk: ContinueSDK, ignore_files: List[str] = []
    ) -> AsyncGenerator[float, None]:
        """Create a new index for the current branch."""

        if self.exists():
            return

        # Get list of filenames to index
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

        # Get file contents for all at once
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

        file_contents = await asyncio.gather(*tasks)

        # Construct list of chunks for each file
        chunks: List[Chunk] = []
        num_chunks_per_file = {}
        for i in range(len(files)):
            document_chunks = [
                c
                for c in chunk_document(files[i], file_contents[i], MAX_CHUNK_SIZE)
                if len(c.content.strip()) > 0
            ]
            num_chunks_per_file[files[i]] = len(document_chunks)
            chunks.extend(document_chunks)

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
                self.collection.add(
                    documents=documents[i : i + 100],
                    metadatas=metadatas[i : i + 100],
                    ids=ids[i : i + 100],
                )
                i += 100

                # Give a progress update (1.0 is completed)
                yield min(1.0, i / len(ids))
                await asyncio.sleep(0.05)
            except RateLimitError as e:
                logger.debug(f"Rate limit exceeded, waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                wait_time *= 2
                if wait_time > 2**10:
                    raise e
            # except sqlite3.OperationalError as e:
            #     logger.debug(f"SQL error: {e}")
            #     os.chmod(self.chroma_dir, 0o777)
            #     os.chmod(os.path.join(self.chroma_dir, "chroma.sqlite3"), 0o777)

        # Metadata keeps track of number of chunks per file, used in update()
        with open(f"{self.index_dir}/metadata.json", "w") as f:
            json.dump(
                {
                    "commit": self.git_project.current_commit,
                    "chunks": num_chunks_per_file,
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

    def query(self, query: str, n: int = 4) -> List[Chunk]:
        """Query the codebase index for top n results"""
        if not self.exists():
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
