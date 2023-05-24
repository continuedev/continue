from typing import Dict, List
from filesystem.filesystem import FileSystem


class VirtualFileSystem(FileSystem):
    """A simulated filesystem from a mapping of filepath to file contents."""
    files: Dict[str, str]

    def __init__(self, files: Dict[str, str]):
        self.files = files

    def read(self, path) -> str:
        return self.files[path]

    def readlines(self, path) -> List[str]:
        return self.files[path].splitlines()

    def write(self, path, content):
        self.files[path] = content

    def exists(self, path) -> bool:
        return path in self.files

    def rename_file(self, filepath: str, new_filepath: str):
        self.files[new_filepath] = self.files[filepath]
        del self.files[filepath]

    def rename_directory(self, path: str, new_path: str):
        for filepath in self.files:
            if filepath.startswith(path):
                new_filepath = new_path + filepath[len(path):]
                self.files[new_filepath] = self.files[filepath]
                del self.files[filepath]

    def delete_file(self, filepath: str):
        del self.files[filepath]

    def add_directory(self, path: str):
        pass
