from abc import ABC, abstractmethod
from typing import List


class FileSystem(ABC):
    """An abstract filesystem that can read/write from a set of files."""
    @abstractmethod
    def read(self, path) -> str:
        raise NotImplementedError

    @abstractmethod
    def readlines(self, path) -> List[str]:
        raise NotImplementedError

    @abstractmethod
    def write(self, path, content):
        raise NotImplementedError

    @abstractmethod
    def exists(self, path) -> bool:
        raise NotImplementedError

    @abstractmethod
    def rename_file(self, filepath: str, new_filepath: str):
        raise NotImplementedError

    @abstractmethod
    def walk(self, path: str) -> List[str]:
        raise NotImplementedError

    @abstractmethod
    def rename_directory(self, path: str, new_path: str):
        raise NotImplementedError

    @abstractmethod
    def delete_file(self, filepath: str):
        raise NotImplementedError

    @abstractmethod
    def delete_directory(self, path: str):
        raise NotImplementedError

    @abstractmethod
    def add_directory(self, path: str):
        raise NotImplementedError
