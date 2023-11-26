import os
from abc import abstractmethod
from typing import Dict, Generator, List, Tuple

from pydantic import BaseModel

from ..libs.util.filter_files import should_filter_path
from ..models.main import AbstractModel, Position, Range
from .filesystem_edit import (
    AddDirectory,
    AddFile,
    DeleteDirectory,
    DeleteFile,
    EditDiff,
    FileEdit,
    FileSystemEdit,
    RenameDirectory,
    RenameFile,
    SequentialFileSystemEdit,
)


class RangeInFile(BaseModel):
    filepath: str
    range: Range

    def __hash__(self):
        return hash((self.filepath, self.range))

    @staticmethod
    def from_entire_file(filepath: str, content: str) -> "RangeInFile":
        range = Range.from_entire_file(content)
        return RangeInFile(filepath=filepath, range=range)

    def translated(self, lines: int):
        return RangeInFile(filepath=self.filepath, range=self.range.translated(lines))

    def with_contents(self, contents: str) -> "RangeInFileWithContents":
        return RangeInFileWithContents.from_range_in_file(self, contents)


class RangeInFileWithContents(RangeInFile):
    """A range in a file with the contents of the range."""

    contents: str

    def __hash__(self):
        return hash((self.filepath, self.range, self.contents))

    def to_range_in_file(self) -> RangeInFile:
        return RangeInFile(filepath=self.filepath, range=self.range)

    def union(self, other: "RangeInFileWithContents") -> "RangeInFileWithContents":
        assert self.filepath == other.filepath
        # Use a placeholder variable for self and swap it with other if other comes before self
        first = self
        second = other
        if other.range.start < self.range.start:
            first = other
            second = self

        assert first.filepath == second.filepath

        # Calculate union of contents
        num_overlapping_lines = first.range.end.line - second.range.start.line + 1
        union_lines = (
            first.contents.splitlines()[:-num_overlapping_lines]
            + second.contents.splitlines()
        )

        return RangeInFileWithContents(
            filepath=first.filepath,
            range=first.range.union(second.range),
            contents="\n".join(union_lines),
        )

    @staticmethod
    def from_entire_file(filepath: str, content: str) -> "RangeInFileWithContents":
        lines = content.splitlines()
        if not lines:
            return RangeInFileWithContents(
                filepath=filepath, range=Range.from_shorthand(0, 0, 0, 0), contents=""
            )
        return RangeInFileWithContents(
            filepath=filepath,
            range=Range.from_shorthand(0, 0, len(lines) - 1, len(lines[-1]) - 1),
            contents=content,
        )

    @staticmethod
    def from_range_in_file(rif: RangeInFile, content: str) -> "RangeInFileWithContents":
        return RangeInFileWithContents(
            filepath=rif.filepath, range=rif.range, contents=content
        )


class FileSystem(AbstractModel):
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
    def read_range_in_file(self, r: RangeInFile) -> str:
        raise NotImplementedError

    @abstractmethod
    def rename_file(self, filepath: str, new_filepath: str):
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

    @abstractmethod
    def apply_file_edit(self, edit: FileEdit) -> EditDiff:
        raise NotImplementedError

    @abstractmethod
    def list_directory_contents(self, path: str, recursive: bool = False) -> List[str]:
        """List the contents of a directory"""
        raise NotImplementedError

    @classmethod
    def read_range_in_str(cls, s: str, r: Range) -> str:
        lines = s.split("\n")[r.start.line : r.end.line + 1]
        if len(lines) == 0:
            return ""

        lines[0] = lines[0][r.start.character :]
        lines[-1] = lines[-1][: r.end.character + 1]
        return "\n".join(lines)

    @classmethod
    def apply_edit_to_str(cls, s: str, edit: FileEdit) -> Tuple[str, EditDiff]:
        original = cls.read_range_in_str(s, edit.range)

        # Split lines and deal with some edge cases (could obviously be nicer)
        lines = s.splitlines()
        if s.startswith("\n"):
            lines.insert(0, "")
        if s.endswith("\n"):
            lines.append("")

        if len(lines) == 0:
            lines = [""]

        end = Position(line=edit.range.end.line, character=edit.range.end.character)
        if edit.range.end.line == len(lines) and edit.range.end.character == 0:
            end = Position(
                line=edit.range.end.line - 1,
                character=len(lines[min(len(lines) - 1, edit.range.end.line - 1)]),
            )

        before_lines = lines[: edit.range.start.line]
        after_lines = lines[end.line + 1 :]
        between_str = (
            lines[min(len(lines) - 1, edit.range.start.line)][
                : edit.range.start.character
            ]
            + edit.replacement
            + lines[min(len(lines) - 1, end.line)][end.character + 1 :]
        )

        new_range = Range(
            start=edit.range.start,
            end=Position(
                line=edit.range.start.line + len(edit.replacement.splitlines()) - 1,
                character=edit.range.start.character
                + len(edit.replacement.splitlines()[-1])
                if edit.replacement != ""
                else 0,
            ),
        )

        lines = before_lines + between_str.splitlines() + after_lines
        return "\n".join(lines), EditDiff(
            forward=edit,
            backward=FileEdit(
                filepath=edit.filepath, range=new_range, replacement=original
            ),
        )

    def reverse_edit_on_str(self, s: str, diff: EditDiff) -> str:
        lines = s.splitlines()

        replacement_lines = diff.replacement.splitlines()
        replacement_d_lines = len(replacement_lines)
        replacement_d_chars = len(replacement_lines[-1])
        replacement_range = Range(
            start=diff.edit.range.start,
            end=Position(
                line=diff.edit.range.start + replacement_d_lines,
                character=diff.edit.range.start.character + replacement_d_chars,
            ),
        )

        before_lines = lines[: replacement_range.start.line]
        after_lines = lines[replacement_range.end.line + 1 :]
        between_str = (
            lines[replacement_range.start.line][: replacement_range.start.character]
            + diff.original
            + lines[replacement_range.end.line][replacement_range.end.character + 1 :]
        )

        lines = before_lines + between_str.splitlines() + after_lines
        return "\n".join(lines)

    def apply_edit(self, edit: FileSystemEdit) -> EditDiff:
        backward = None
        if isinstance(edit, FileEdit):
            diff = self.apply_file_edit(edit)
            backward = diff.backward
        elif isinstance(edit, AddFile):
            self.write(edit.filepath, edit.content)
            backward = DeleteFile(edit.filepath)
        elif isinstance(edit, DeleteFile):
            contents = self.read(edit.filepath)
            backward = AddFile(edit.filepath, contents)
            self.delete_file(edit.filepath)
        elif isinstance(edit, RenameFile):
            self.rename_file(edit.filepath, edit.new_filepath)
            backward = RenameFile(
                filepath=edit.new_filepath, new_filepath=edit.filepath
            )
        elif isinstance(edit, AddDirectory):
            self.add_directory(edit.path)
            backward = DeleteDirectory(edit.path)
        elif isinstance(edit, DeleteDirectory):
            # This isn't atomic!
            backward_edits = []
            for root, dirs, files in os.walk(edit.path, topdown=False):
                for f in files:
                    path = os.path.join(root, f)
                    backward_edits.append(self.apply_edit(DeleteFile(path)))
                for d in dirs:
                    path = os.path.join(root, d)
                    backward_edits.append(self.apply_edit(DeleteDirectory(path)))

            backward_edits.append(self.apply_edit(DeleteDirectory(edit.path)))
            backward_edits.reverse()
            backward = SequentialFileSystemEdit(edits=backward_edits)
        elif isinstance(edit, RenameDirectory):
            self.rename_directory(edit.path, edit.new_path)
            backward = RenameDirectory(path=edit.new_path, new_path=edit.path)
        elif isinstance(edit, FileSystemEdit):
            backward_edits = []
            for edit in edit.next_edit():
                backward_edits.append(self.apply_edit(edit))
            backward_edits.reverse()
            backward = SequentialFileSystemEdit(edits=backward_edits)
        else:
            raise TypeError("Unknown FileSystemEdit type: " + str(type(edit)))

        return EditDiff(forward=edit, backward=backward)


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

    def read_range_in_file(self, r: RangeInFile) -> str:
        return FileSystem.read_range_in_str(self.read(r.filepath), r.range)

    def rename_file(self, filepath: str, new_filepath: str):
        os.rename(filepath, new_filepath)

    def rename_directory(self, path: str, new_path: str):
        os.rename(path, new_path)

    def delete_file(self, filepath: str):
        os.remove(filepath)

    def delete_directory(self, path: str):
        raise NotImplementedError

    def add_directory(self, path: str):
        os.makedirs(path)

    def apply_file_edit(self, edit: FileEdit) -> EditDiff:
        old_content = self.read(edit.filepath)
        new_content, diff = FileSystem.apply_edit_to_str(old_content, edit)
        self.write(edit.filepath, new_content)
        return diff

    def list_directory_contents(self, path: str, recursive: bool = False) -> List[str]:
        """List the contents of a directory"""
        if recursive:
            # Walk
            paths = []
            for root, dirs, files in os.walk(path):
                dirs[:] = list(filter(lambda p: not should_filter_path(p), dirs))
                for f in files:
                    paths.append(os.path.join(root, f))

            return paths
        return list(map(lambda x: os.path.join(path, x), os.listdir(path)))


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

    def read_range_in_file(self, r: RangeInFile) -> str:
        return FileSystem.read_range_in_str(self.read(r.filepath), r.range)

    def rename_file(self, filepath: str, new_filepath: str):
        self.files[new_filepath] = self.files[filepath]
        del self.files[filepath]

    def rename_directory(self, path: str, new_path: str):
        for filepath in self.files:
            if filepath.startswith(path):
                new_filepath = new_path + filepath[len(path) :]
                self.files[new_filepath] = self.files[filepath]
                del self.files[filepath]

    def delete_file(self, filepath: str):
        del self.files[filepath]

    def delete_directory(self, path: str):
        raise NotImplementedError

    def add_directory(self, path: str):
        # For reasons as seen here and in delete_directory, a Dict[str, str] might not be the best representation. Could just preprocess to something better upon __init__
        pass

    def apply_file_edit(self, edit: FileEdit) -> EditDiff:
        old_content = self.read(edit.filepath)
        new_content, original = FileSystem.apply_edit_to_str(old_content, edit)
        self.write(edit.filepath, new_content)
        return EditDiff(edit=edit, original=original)

    def list_directory_contents(
        self, path: str, recursive: bool = False
    ) -> Generator[str, None, None]:
        """List the contents of a directory"""
        if recursive:
            for filepath in self.files:
                if filepath.startswith(path):
                    yield filepath

        for filepath in self.files:
            if filepath.startswith(path) and "/" not in filepath[len(path) :]:
                yield filepath


# TODO: Uniform errors thrown by any FileSystem subclass.
