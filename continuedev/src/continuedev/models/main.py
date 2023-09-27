from abc import ABC
from functools import total_ordering
from typing import List, Tuple, Union

from pydantic import BaseModel, root_validator


class ContinueBaseModel(BaseModel):
    class Config:
        underscore_attrs_are_private = True


@total_ordering
class Position(BaseModel):
    line: int
    character: int

    def __hash__(self):
        return hash((self.line, self.character))

    def __eq__(self, other: "Position") -> bool:
        return self.line == other.line and self.character == other.character

    def __lt__(self, other: "Position") -> bool:
        if self.line < other.line:
            return True
        elif self.line == other.line:
            return self.character < other.character
        else:
            return False

    @staticmethod
    def from_index(string: str, index: int) -> "Position":
        """Convert index in string to line and character"""
        line = string.count("\n", 0, index)
        if line == 0:
            character = index
        else:
            character = index - string.rindex("\n", 0, index) - 1

        return Position(line=line, character=character)

    @staticmethod
    def from_end_of_file(contents: str) -> "Position":
        return Position.from_index(contents, len(contents))

    def to_index(self, string: str) -> int:
        """Convert line and character to index in string"""
        lines = string.splitlines()
        return sum(map(len, lines[: self.line])) + self.character


class PositionInFile(BaseModel):
    position: Position
    filepath: str


class Range(BaseModel):
    """A range in a file. 0-indexed."""

    start: Position
    end: Position

    def __lt__(self, other: "Range") -> bool:
        return self.start < other.start or (
            self.start == other.start and self.end < other.end
        )

    def __eq__(self, other: "Range") -> bool:
        return self.start == other.start and self.end == other.end

    def __hash__(self):
        return hash((self.start, self.end))

    def union(self, other: "Range") -> "Range":
        return Range(
            start=min(self.start, other.start),
            end=max(self.end, other.end),
        )

    def is_empty(self) -> bool:
        return self.start == self.end

    def indices_in_string(self, string: str) -> Tuple[int, int]:
        """Get the start and end indices of this range in the string"""
        lines = string.splitlines()
        if len(lines) == 0:
            return (0, 0)

        start_index = (
            sum([len(line) + 1 for line in lines[: self.start.line]])
            + self.start.character
        )
        end_index = (
            sum([len(line) + 1 for line in lines[: self.end.line]]) + self.end.character
        )
        return (start_index, end_index)

    def overlaps_with(self, other: "Range") -> bool:
        return not (self.end < other.start or self.start > other.end)

    def to_full_lines(self) -> "Range":
        return Range(
            start=Position(line=self.start.line, character=0),
            end=Position(line=self.end.line + 1, character=0),
        )

    def translated(self, lines: int):
        return Range(
            start=Position(
                line=self.start.line + lines, character=self.start.character
            ),
            end=Position(line=self.end.line + lines, character=self.end.character),
        )

    def contains(self, position: Position) -> bool:
        return self.start <= position and position <= self.end

    def merge_with(self, other: "Range") -> "Range":
        return Range(
            start=min(self.start, other.start).copy(),
            end=max(self.end, other.end).copy(),
        )

    @staticmethod
    def from_indices(string: str, start_index: int, end_index: int) -> "Range":
        return Range(
            start=Position.from_index(string, start_index),
            end=Position.from_index(string, end_index),
        )

    @staticmethod
    def from_shorthand(
        start_line: int, start_char: int, end_line: int, end_char: int
    ) -> "Range":
        return Range(
            start=Position(line=start_line, character=start_char),
            end=Position(line=end_line, character=end_char),
        )

    @staticmethod
    def from_entire_file(content: str) -> "Range":
        lines = content.splitlines()
        if len(lines) == 0:
            return Range.from_shorthand(0, 0, 0, 0)
        return Range.from_shorthand(0, 0, len(lines), 0)

    @staticmethod
    def from_snippet_in_file(content: str, snippet: str) -> "Range":
        start_index = content.index(snippet)
        end_index = start_index + len(snippet)
        return Range.from_indices(content, start_index, end_index)

    @staticmethod
    def from_lines_snippet_in_file(content: str, snippet: str) -> "Range":
        # lines is a substring of the content modulo whitespace on each line
        content_lines = content.splitlines()
        snippet_lines = snippet.splitlines()

        start_line = -1
        end_line = -1
        looking_for_line = 0
        for i in range(len(content_lines)):
            if content_lines[i].strip() == snippet_lines[looking_for_line].strip():
                if looking_for_line == len(snippet_lines) - 1:
                    start_line = i - len(snippet_lines) + 1
                    end_line = i
                    break
                looking_for_line += 1
            else:
                looking_for_line = 0

        if start_line == -1 or end_line == -1:
            raise ValueError("Snippet not found in content")

        return Range.from_shorthand(
            start_line, 0, end_line, len(content_lines[end_line]) - 1
        )

    @staticmethod
    def from_position(position: Position) -> "Range":
        return Range(start=position, end=position)


class AbstractModel(ABC, BaseModel):
    @root_validator(pre=True)
    def check_is_subclass(cls, values):
        if not issubclass(cls, AbstractModel):
            raise TypeError(
                "AbstractModel subclasses must be subclasses of AbstractModel"
            )


class TracebackFrame(BaseModel):
    filepath: str
    lineno: int
    function: str
    code: Union[str, None]

    def __eq__(self, other):
        return (
            self.filepath == other.filepath
            and self.lineno == other.lineno
            and self.function == other.function
        )


class Traceback(BaseModel):
    frames: List[TracebackFrame]
    message: str
    error_type: str
    full_traceback: Union[str, None]

    @classmethod
    def from_tbutil_parsed_exc(cls, tbutil_parsed_exc):
        return cls(
            frames=[
                TracebackFrame(
                    filepath=frame["filepath"],
                    lineno=frame["lineno"],
                    function=frame["funcname"],
                    code=frame["source_line"],
                )
                for frame in tbutil_parsed_exc.frames
            ],
            message=tbutil_parsed_exc.exc_msg,
            error_type=tbutil_parsed_exc.exc_type,
            full_traceback=tbutil_parsed_exc.to_string(),
        )
