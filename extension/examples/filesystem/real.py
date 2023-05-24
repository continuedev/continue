import os
from typing import List
from filesystem.filesystem import FileSystem


class RealFileSystem(FileSystem):
    """A filesystem that reads/writes from the actual filesystem."""

    def read(self, path) -> str:
        with open(path, "r") as f:
            return f.read()

    def readlines(self, path) -> List[str]:
        with open(path, "r") as f:
            return f.readlines()

    def write(self, path, content):
        with open(path, "w") as f:
            f.write(content)

    def exists(self, path) -> bool:
        return os.path.exists(path)

    def rename_file(self, filepath: str, new_filepath: str):
        os.rename(filepath, new_filepath)

    def rename_directory(self, path: str, new_path: str):
        os.rename(path, new_path)

    def delete_file(self, filepath: str):
        os.remove(filepath)

    def add_directory(self, path: str):
        os.makedirs(path)
