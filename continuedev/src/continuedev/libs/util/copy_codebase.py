import os
from pathlib import Path
from typing import Iterable, List, Union
from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler
from ..models.main import FileEdit, DeleteDirectory, DeleteFile, AddDirectory, AddFile, FileSystemEdit, Position, Range, RenameFile, RenameDirectory, SequentialFileSystemEdit
from ..models.filesystem import FileSystem
from ..libs.main import Agent
from ..libs.map_path import map_path
from ..libs.steps.main import ManualEditAction
import shutil
import difflib


def create_copy(orig_root: str, copy_root: str = None, ignore: Iterable[str] = []):
    # TODO: Make ignore a spec, like .gitignore
    if copy_root is None:
        copy_root = Path(orig_root) / ".continue-copy"
    ignore.append(str(copy_root))
    ignore = set(ignore)

    os.mkdir(copy_root)
    # I think you're messing up a lot of absolute paths here
    for child in os.listdir():
        if os.path.isdir(child):
            if child not in ignore:
                os.mkdir(map_path(child))
                create_copy(Path(orig_root) / child,
                            Path(copy_root) / child, ignore)
            else:
                os.symlink(child, map_path(child))
        else:
            if child not in ignore:
                shutil.copyfile(child, map_path(child))
            else:
                os.symlink(child, map_path(child))


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
            edits.append(FileEdit(filepath, Range.from_indices(
                original, i1, i2), replacement))
            offset += (j2 - j1) - (i2 + i1)
        else:
            raise Exception("Unexpected difflib.SequenceMatcher tag: " + tag)

    return edits


# The whole usage of watchdog here should only be specific to RealFileSystem, you want to have a different "Observer" class for VirtualFileSystem, which would depend on being sent notifications
class CopyCodebaseEventHandler(PatternMatchingEventHandler):
    def __init__(self, ignore_directories: List[str], ignore_patterns: List[str], agent: Agent, orig_root: str, copy_root: str, filesystem: FileSystem):
        super().__init__(ignore_directories=ignore_directories, ignore_patterns=ignore_patterns)
        self.agent = agent
        self.orig_root = orig_root
        self.copy_root = copy_root
        self.filesystem = filesystem

    # For now, we'll just make the update immediately, but eventually need to sync with agent.
    # It should be the agent that makes the update right? It's just another action, everything comes from a single stream.

    def _event_to_edit(self, event) -> Union[FileSystemEdit, None]:
        # NOTE: You'll need to map paths to create both an action within the copy filesystem (the one you take) and one in the original fileystem (the one you'll record and allow the user to accept). Basically just need a converter built in to the FileSystemEdit class
        src = event.src_path()
        if event.is_directory:
            if event.event_type == "moved":
                return RenameDirectory(src, event.dest_path())
            elif event.event_type == "deleted":
                return DeleteDirectory(src)
            elif event.event_type == "created":
                return AddDirectory(src)
        else:
            if event.event_type == "moved":
                return RenameFile(src, event.dest_path())
            elif event.event_type == "deleted":
                return DeleteFile(src)
            elif event.event_type == "created":
                contents = self.filesystem.read(src)
                # Unclear whether it will always pass a "modified" event right after if something like echo "abc" > newfile.txt happens
                return AddFile(src, contents)
            elif event.event_type == "modified":
                # Watchdog doesn't pass the contents or edit, so have to get it myself and diff
                updated = self.filesystem.read(src)
                copy_filepath = map_path(src, self.orig_root, self.copy_root)
                old = self.filesystem.read(copy_filepath)

                edits = calculate_diff(src, updated, old)
                return SequentialFileSystemEdit(edits)
        return None

    def on_any_event(self, event):
        edit = self._event_to_edit(event)
        if edit is None:
            return
        edit = edit.with_mapped_paths(self.orig_root, self.copy_root)
        action = ManualEditAction(edit)
        self.agent.act(action)


def maintain_copy_workspace(agent: Agent, filesystem: FileSystem, orig_root: str, copy_root: str):
    observer = Observer()
    event_handler = CopyCodebaseEventHandler(
        [".git"], [], agent, orig_root, copy_root, filesystem)
    observer.schedule(event_handler, orig_root, recursive=True)
    observer.start()
    try:
        while observer.isAlive():
            observer.join(1)
    finally:
        observer.stop()
        observer.join()
