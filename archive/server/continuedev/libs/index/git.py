from functools import cached_property
import os
import subprocess
from typing import List, Tuple

from .update import filter_ignored_files


class GitProject:
    directory: str

    def __init__(self, directory: str):
        self.directory = directory

    @cached_property
    def current_commit(self) -> str:
        """Get the current commit."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "HEAD"], cwd=self.directory
                )
                .decode("utf-8")
                .strip()
            )
        except Exception:
            return "NONE"

    @cached_property
    def current_branch(self) -> str:
        """Get the current branch."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=self.directory
                )
                .decode("utf-8")
                .strip()
            )
        except Exception:
            return "NONE"

    @cached_property
    def git_root_dir(self):
        """Get the root directory of a Git repository."""
        try:
            return (
                subprocess.check_output(
                    ["git", "rev-parse", "--show-toplevel"], cwd=self.directory
                )
                .strip()
                .decode()
            )
        except Exception:
            return None

    def get_modified_deleted_files(
        self, since_commit: str
    ) -> Tuple[List[str], List[str]]:
        """Get a list of all files that have been modified since the last commit."""

        try:
            modified_deleted_files = (
                subprocess.check_output(
                    ["git", "diff", "--name-only", since_commit, self.current_commit]
                )
                .decode("utf-8")
                .strip()
            )
        except Exception:
            return [], []

        modified_deleted_files = modified_deleted_files.split("\n")
        modified_deleted_files = [f for f in modified_deleted_files if f]

        deleted_files = [
            f
            for f in modified_deleted_files
            if not os.path.exists(os.path.join(self.directory, f))
        ]
        modified_files = [
            f
            for f in modified_deleted_files
            if os.path.exists(os.path.join(self.directory, f))
        ]

        return filter_ignored_files(
            modified_files, self.index_dir
        ), filter_ignored_files(deleted_files, self.index_dir)
