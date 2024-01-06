import os
from abc import abstractmethod
from typing import Generator, List

from pydantic import BaseModel

from ..libs.util.map_path import map_path
from .main import Position, Range


class FileSystemEdit(BaseModel):
    @abstractmethod
    def next_edit(self) -> Generator["FileSystemEdit", None, None]:
        raise NotImplementedError

    @abstractmethod
    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        raise NotImplementedError


class AtomicFileSystemEdit(FileSystemEdit):
    def next_edit(self) -> Generator["FileSystemEdit", None, None]:
        yield self


class FileEdit(AtomicFileSystemEdit):
    filepath: str
    range: Range
    replacement: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return FileEdit(
            filepath=map_path(self.filepath, orig_root, copy_root),
            range=self.range,
            replacement=self.replacement,
        )

    @staticmethod
    def from_deletion(filepath: str, range: Range) -> "FileEdit":
        return FileEdit(filepath=filepath, range=range, replacement="")

    @staticmethod
    def from_insertion(filepath: str, position: Position, content: str) -> "FileEdit":
        return FileEdit(
            filepath=filepath,
            range=Range.from_shorthand(
                position.line, position.character, position.line, position.character
            ),
            replacement=content,
        )

    @staticmethod
    def from_append(
        filepath: str, previous_content: str, appended_content: str
    ) -> "FileEdit":
        return FileEdit(
            filepath=filepath,
            range=Range.from_position(Position.from_end_of_file(previous_content)),
            replacement=appended_content,
        )


class FileEditWithFullContents(BaseModel):
    fileEdit: FileEdit
    fileContents: str


class AddFile(AtomicFileSystemEdit):
    filepath: str
    content: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return AddFile(
            filepath=map_path(self.filepath, orig_root, copy_root), content=self.content
        )


class DeleteFile(AtomicFileSystemEdit):
    filepath: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return DeleteFile(filepath=map_path(self.filepath, orig_root, copy_root))


class RenameFile(AtomicFileSystemEdit):
    filepath: str
    new_filepath: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return RenameFile(
            filepath=map_path(self.filepath, orig_root, copy_root),
            new_filepath=map_path(self.new_filepath, orig_root, copy_root),
        )


class AddDirectory(AtomicFileSystemEdit):
    path: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return AddDirectory(path=map_path(self.path, orig_root, copy_root))


class DeleteDirectory(AtomicFileSystemEdit):
    path: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return DeleteDirectory(path=map_path(self.path, orig_root, copy_root))


class RenameDirectory(AtomicFileSystemEdit):
    path: str
    new_path: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return RenameDirectory(
            path=map_path(self.path, orig_root, copy_root),
            new_path=map_path(self.new_path, orig_root, copy_root),
        )


class DeleteDirectoryRecursive(FileSystemEdit):
    path: str

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return DeleteDirectoryRecursive(path=map_path(self.path, orig_root, copy_root))

    def next_edit(self) -> Generator[FileSystemEdit, None, None]:
        yield DeleteDirectory(path=self.path)
        for child in os.listdir(self.path):
            child_path = os.path.join(self.path, child)
            if os.path.isdir(child_path):
                yield DeleteDirectoryRecursive(path=child_path)
            else:
                yield DeleteFile(filepath=child_path)


class SequentialFileSystemEdit(FileSystemEdit):
    edits: List[FileSystemEdit]

    def with_mapped_paths(self, orig_root: str, copy_root: str) -> "FileSystemEdit":
        return SequentialFileSystemEdit(
            edits=[edit.with_mapped_paths(orig_root, copy_root) for edit in self.edits]
        )

    def next_edit(self) -> Generator["FileSystemEdit", None, None]:
        for edit in self.edits:
            yield from edit.next_edit()


class EditDiff(BaseModel):
    """A reversible edit that can be applied to a file."""

    forward: FileSystemEdit
    backward: FileSystemEdit

    @classmethod
    def from_sequence(cls, diffs: List["EditDiff"]) -> "EditDiff":
        forwards = []
        backwards = []
        for diff in diffs:
            forwards.append(diff.forward)
            backwards.insert(0, diff.backward)
        return cls(
            forward=SequentialFileSystemEdit(edits=forwards),
            backward=SequentialFileSystemEdit(edits=backwards),
        )
