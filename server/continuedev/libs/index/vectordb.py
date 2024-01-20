from abc import ABC, abstractmethod
from typing import List, NoReturn

from .chunkers.chunk import Chunk


class VectorDB(ABC):
    @abstractmethod
    def query(query: str, n: int = 4) -> List[Chunk]:
        raise NotImplementedError

    @abstractmethod
    def insert(chunks: List[Chunk]) -> NoReturn:
        raise NotImplementedError


class ChromaVectorDB(VectorDB):
    def query(self, query: str, n: int = 4) -> NoReturn:
        raise NotImplementedError

    def insert(self, chunks: List[Chunk]) -> NoReturn:
        raise NotImplementedError
