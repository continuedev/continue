import difflib
from typing import List
from ...models.main import Position, Range
from ...models.filesystem import FileEdit
from diff_match_patch import diff_match_patch


def calculate_diff_match_patch(filepath: str, original: str, updated: str) -> List[FileEdit]:
    dmp = diff_match_patch()
    diffs = dmp.diff_main(original, updated)
    dmp.diff_cleanupSemantic(diffs)

    replacements = []

    current_index = 0
    deleted_length = 0

    for diff in diffs:
        if diff[0] == diff_match_patch.DIFF_EQUAL:
            current_index += len(diff[1])
            deleted_length = 0
        elif diff[0] == diff_match_patch.DIFF_INSERT:
            current_index += deleted_length
            replacements.append((current_index, current_index, diff[1]))
            current_index += len(diff[1])
            deleted_length = 0
        elif diff[0] == diff_match_patch.DIFF_DELETE:
            replacements.append(
                (current_index, current_index + len(diff[1]), ''))
            deleted_length += len(diff[1])
        elif diff[0] == diff_match_patch.DIFF_REPLACE:
            replacements.append(
                (current_index, current_index + len(diff[1]), ''))
            current_index += deleted_length
            replacements.append((current_index, current_index, diff[2]))
            current_index += len(diff[2])
            deleted_length = 0

    return [FileEdit(filepath=filepath, range=Range.from_indices(original, r[0], r[1]), replacement=r[2]) for r in replacements]


def calculate_diff(filepath: str, original: str, updated: str) -> List[FileEdit]:
    s = difflib.SequenceMatcher(None, original, updated)
    offset = 0  # The indices are offset by previous deletions/insertions
    edits = []
    for tag, i1, i2, j1, j2 in s.get_opcodes():
        i1, i2, j1, j2 = i1 + offset, i2 + offset, j1 + offset, j2 + offset
        replacement = updated[j1:j2]
        if tag == "equal":
            pass
        elif tag == "delete":
            edits.append(FileEdit.from_deletion(
                filepath, Range.from_indices(original, i1, i2)))
            offset -= i2 - i1
        elif tag == "insert":
            edits.append(FileEdit.from_insertion(
                filepath, Position.from_index(original, i1), replacement))
            offset += j2 - j1
        elif tag == "replace":
            edits.append(FileEdit(filepath=filepath, range=Range.from_indices(
                original, i1, i2), replacement=replacement))
            offset += (j2 - j1) - (i2 - i1)
        else:
            raise Exception("Unexpected difflib.SequenceMatcher tag: " + tag)

    return edits


def calculate_diff2(filepath: str, original: str, updated: str) -> List[FileEdit]:
    # original_lines = original.splitlines()
    # updated_lines = updated.splitlines()
    # offset = 0
    # while len(original_lines) and len(updated_lines) and original_lines[0] == updated_lines[0]:
    #     original_lines = original_lines[1:]
    #     updated_lines = updated_lines[1:]

    # while len(original_lines) and len(updated_lines) and original_lines[-1] == updated_lines[-1]:
    #     original_lines = original_lines[:-1]
    #     updated_lines = updated_lines[:-1]

    # original = "\n".join(original_lines)
    # updated = "\n".join(updated_lines)

    edits = []
    max_iterations = 1000
    i = 0
    while not original == updated:
        # TODO - For some reason it can't handle a single newline at the end of the file?
        s = difflib.SequenceMatcher(None, original, updated)
        opcodes = s.get_opcodes()
        for edit_index in range(len(opcodes)):
            tag, i1, i2, j1, j2 = s.get_opcodes()[edit_index]
            replacement = updated[j1:j2]
            if tag == "equal":
                continue
            elif tag == "delete":
                edits.append(FileEdit.from_deletion(
                    filepath, Range.from_indices(original, i1, i2)))
            elif tag == "insert":
                edits.append(FileEdit.from_insertion(
                    filepath, Position.from_index(original, i1), replacement))
            elif tag == "replace":
                edits.append(FileEdit(filepath=filepath, range=Range.from_indices(
                    original, i1, i2), replacement=replacement))
            else:
                raise Exception(
                    "Unexpected difflib.SequenceMatcher tag: " + tag)
            break

        original = apply_edit_to_str(original, edits[-1])

        i += 1
        if i > max_iterations:
            raise Exception("Max iterations reached")

    return edits


def read_range_in_str(s: str, r: Range) -> str:
    lines = s.splitlines()[r.start.line:r.end.line + 1]
    if len(lines) == 0:
        return ""

    lines[0] = lines[0][r.start.character:]
    lines[-1] = lines[-1][:r.end.character + 1]
    return "\n".join(lines)


def apply_edit_to_str(s: str, edit: FileEdit) -> str:
    original = read_range_in_str(s, edit.range)

    # Split lines and deal with some edge cases (could obviously be nicer)
    lines = s.splitlines()
    if s.startswith("\n"):
        lines.insert(0, "")
    if s.endswith("\n"):
        lines.append("")

    if len(lines) == 0:
        lines = [""]

    end = Position(line=edit.range.end.line,
                   character=edit.range.end.character)
    if edit.range.end.line == len(lines) and edit.range.end.character == 0:
        end = Position(line=edit.range.end.line - 1,
                       character=len(lines[min(len(lines) - 1, edit.range.end.line - 1)]))

    before_lines = lines[:edit.range.start.line]
    after_lines = lines[end.line + 1:]
    between_str = lines[min(len(lines) - 1, edit.range.start.line)][:edit.range.start.character] + \
        edit.replacement + \
        lines[min(len(lines) - 1, end.line)][end.character + 1:]

    new_range = Range(
        start=edit.range.start,
        end=Position(
            line=edit.range.start.line +
            len(edit.replacement.splitlines()) - 1,
            character=edit.range.start.character +
            len(edit.replacement.splitlines()
                [-1]) if edit.replacement != "" else 0
        )
    )

    lines = before_lines + between_str.splitlines() + after_lines
    return "\n".join(lines)
