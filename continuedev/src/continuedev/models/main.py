from abc import ABC
from typing import List, Union
from pydantic import BaseModel, root_validator
from functools import total_ordering


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
        if line == 1:
            character = index
        else:
            character = index - string.rindex("\n", 0, index) - 1

        return Position(line=line, character=character)


class Range(BaseModel):
    """A range in a file. 0-indexed."""
    start: Position
    end: Position

    def __hash__(self):
        return hash((self.start, self.end))

    def union(self, other: "Range") -> "Range":
        return Range(
            start=min(self.start, other.start),
            end=max(self.end, other.end),
        )

    def is_empty(self) -> bool:
        return self.start == self.end

    def overlaps_with(self, other: "Range") -> bool:
        return not (self.end < other.start or self.start > other.end)

    @staticmethod
    def from_indices(string: str, start_index: int, end_index: int) -> "Range":
        return Range(
            start=Position.from_index(string, start_index),
            end=Position.from_index(string, end_index)
        )

    @staticmethod
    def from_shorthand(start_line: int, start_char: int, end_line: int, end_char: int) -> "Range":
        return Range(
            start=Position(
                line=start_line,
                character=start_char
            ),
            end=Position(
                line=end_line,
                character=end_char
            )
        )

    @staticmethod
    def from_entire_file(content: str) -> "Range":
        lines = content.splitlines()
        if len(lines) == 0:
            return Range.from_shorthand(0, 0, 0, 0)
        return Range.from_shorthand(0, 0, len(lines) - 1, len(lines[-1]) - 1)

    @staticmethod
    def from_snippet_in_file(content: str, snippet: str) -> "Range":
        start_index = content.index(snippet)
        end_index = start_index + len(snippet)
        return Range.from_indices(content, start_index, end_index)


class AbstractModel(ABC, BaseModel):
    @root_validator(pre=True)
    def check_is_subclass(cls, values):
        if not issubclass(cls, AbstractModel):
            raise TypeError(
                "AbstractModel subclasses must be subclasses of AbstractModel")


class TracebackFrame(BaseModel):
    filepath: str
    lineno: int
    function: str
    code: Union[str, None]

    def __eq__(self, other):
        return self.filepath == other.filepath and self.lineno == other.lineno and self.function == other.function


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
