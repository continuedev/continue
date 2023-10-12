# import faiss
import os
import subprocess
from typing import List

from dotenv import load_dotenv

load_dotenv()

FILE_TYPES_TO_IGNORE = [".pyc", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico"]


def filter_ignored_files(files: List[str], root_dir: str):
    """Further filter files before indexing."""
    for file in files:
        if (
            file.endswith(tuple(FILE_TYPES_TO_IGNORE))
            or file.startswith(".git")
            or file.startswith("archive")
        ):
            continue  # nice
        yield root_dir + "/" + file


def get_git_ignored_files(root_dir: str):
    """Get the list of ignored files in a Git repository."""
    try:
        output = (
            subprocess.check_output(
                ["git", "ls-files", "--ignored", "--others", "--exclude-standard"],
                cwd=root_dir,
            )
            .strip()
            .decode()
        )
        return output.split("\n")
    except subprocess.CalledProcessError:
        return []


def get_all_files(root_dir: str):
    """Get a list of all files in a directory."""
    for dir_path, _, file_names in os.walk(root_dir):
        for file_name in file_names:
            yield os.path.join(os.path.relpath(dir_path, root_dir), file_name)


def get_input_files(root_dir: str):
    """Get a list of all files in a Git repository that are not ignored."""
    ignored_files = set(get_git_ignored_files(root_dir))
    all_files = set(get_all_files(root_dir))
    nonignored_files = all_files - ignored_files
    return filter_ignored_files(nonignored_files, root_dir)
