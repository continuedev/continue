from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional

from ....server.protocols.ide_protocol import AbstractIdeProtocolServer

from ....core.sdk import ContinueSDK
from ..chunkers import Chunk


class CodebaseIndex(ABC):
    directory: str

    def __init__(self, directory: str):
        self.directory = directory

    @abstractmethod
    async def exists(self) -> bool:
        """Returns whether the index exists (has been built)"""
        raise NotImplementedError()

    @abstractmethod
    async def build(self, chunks: AsyncGenerator[Chunk, None]):
        """Builds the index, yielding progress as a float between 0 and 1. Chunks are yielded from the given generator."""
        raise NotImplementedError()

    @abstractmethod
    async def update(self) -> AsyncGenerator[float, None]:
        """Updates the index, yielding progress as a float between 0 and 1"""
        raise NotImplementedError()

    @abstractmethod
    async def query(self, query: str, n: int = 4) -> List[Chunk]:
        """Queries the index, returning the top n results"""
        raise NotImplementedError()
