# TODO:
"""
- Follow .continueignore
- How do we know to remove embeddings?
On window load, check the list of branches against
those you have indexed. Then purge any that don't exist.
"""

from contextlib import contextmanager
import os
from typing import Generator
from ...util.paths import getGlobalFolderPath
import pygit2

SET_PATH = os.path.join(getGlobalFolderPath(), "set")


class DiskSet:
    """
    Checks if an object is already indexed

    The spec here is you need:
    - On disk
    - Set operations
    - False positives not okay
    - False negatives okay

    So you want a direct hash table with fairly small size.
    You can just truncate the hash to some size.
    And then
    """

    def __init__(self):
        if not os.path.exists(SET_PATH):
            with open(SET_PATH, "w") as f:
                f.write("")

        self.file = open(SET_PATH, "a+")

    def __contains__(self, item: str) -> bool:
        self.file.seek(0)
        for line in self.file.readlines():
            if line.strip() == item:
                return True
        return False

    def add(self, item: str) -> None:
        if item in self:
            return

        self.file.write(item + "\n")
        self.file.flush()

    def remove(self, item: str) -> None:
        self.file.seek(0)
        lines = self.file.readlines()
        self.file.seek(0)
        self.file.truncate(0)
        for line in lines:
            if line.strip() != item:
                self.file.write(line)

    def close(self) -> None:
        self.file.close()


@contextmanager
def disk_set() -> Generator[DiskSet, None, None]:
    set = DiskSet()
    try:
        yield set
    finally:
        set.close()


def stream_files_to_update(repo_root: str) -> Generator[str, None, None]:
    repo = pygit2.Repository(repo_root)
    commit = repo.head.peel(pygit2.Commit)

    with disk_set() as already_indexed:
        yield from files_to_update_in(commit, already_indexed)

    # Yield from files changed in the working tree
    for filepath, flags in repo.status().items():
        if flags.status == pygit2.GIT_STATUS_CURRENT:
            continue
        if flags.status == pygit2.GIT_STATUS_INDEX_NEW:
            yield filepath
        elif flags.status == pygit2.GIT_STATUS_INDEX_MODIFIED:
            yield filepath
        elif flags.status == pygit2.GIT_STATUS_INDEX_DELETED:
            continue
        elif flags.status == pygit2.GIT_STATUS_WT_NEW:
            yield filepath
        elif flags.status == pygit2.GIT_STATUS_WT_MODIFIED:
            yield filepath
        elif flags.status == pygit2.GIT_STATUS_WT_DELETED:
            continue
        elif flags.status == pygit2.GIT_STATUS_IGNORED:
            continue
        elif flags.status == pygit2.GIT_STATUS_CONFLICTED:
            continue
        else:
            raise Exception("Unknown diff status: " + str(flags))


def files_to_update_in(
    obj: pygit2.Object, already_indexed: DiskSet
) -> Generator[str, None, None]:
    """Given an object, yield all files to update"""
    if obj.hex in already_indexed:
        return

    if obj.type == pygit2.GIT_OBJ_BLOB:
        yield obj.name
    elif obj.type == pygit2.GIT_OBJ_TREE:
        for entry in obj:
            yield from files_to_update_in(entry)
    elif obj.type == pygit2.GIT_OBJ_COMMIT:
        yield from files_to_update_in(obj.tree)
    else:
        raise Exception("Unknown type: " + str(obj.type))
