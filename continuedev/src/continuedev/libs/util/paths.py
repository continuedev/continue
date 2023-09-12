import os

from ..constants.default_config import default_config
from ..constants.main import (
    CONTINUE_GLOBAL_FOLDER,
    CONTINUE_SERVER_FOLDER,
    CONTINUE_SESSIONS_FOLDER,
)


def find_data_file(filename):
    datadir = os.path.dirname(__file__)
    return os.path.abspath(os.path.join(datadir, filename))


def getGlobalFolderPath():
    path = os.path.join(os.path.expanduser("~"), CONTINUE_GLOBAL_FOLDER)
    os.makedirs(path, exist_ok=True)
    return path


def getSessionsFolderPath():
    path = os.path.join(getGlobalFolderPath(), CONTINUE_SESSIONS_FOLDER)
    os.makedirs(path, exist_ok=True)
    return path


def getServerFolderPath():
    path = os.path.join(getGlobalFolderPath(), CONTINUE_SERVER_FOLDER)
    os.makedirs(path, exist_ok=True)
    return path


def getDevDataFolderPath():
    path = os.path.join(getGlobalFolderPath(), "dev_data")
    os.makedirs(path, exist_ok=True)
    return path


def getDiffsFolderPath():
    path = os.path.join(getGlobalFolderPath(), "diffs")
    os.makedirs(path, exist_ok=True)
    return path


def getDevDataFilePath(table_name: str):
    filepath = os.path.join(getDevDataFolderPath(), f"{table_name}.jsonl")
    if not os.path.exists(filepath):
        with open(filepath, "w") as f:
            f.write("")

    return filepath


def getMeilisearchExePath():
    binary_name = "meilisearch.exe" if os.name == "nt" else "meilisearch"
    path = os.path.join(getServerFolderPath(), binary_name)
    return path


def getSessionFilePath(session_id: str):
    path = os.path.join(getSessionsFolderPath(), f"{session_id}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def getSessionsListFilePath():
    path = os.path.join(getSessionsFolderPath(), "sessions.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write("[]")
    return path


def getConfigFilePath() -> str:
    path = os.path.join(getGlobalFolderPath(), "config.py")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(default_config)
    else:
        with open(path, "r") as f:
            existing_content = f.read()

        if existing_content.strip() == "":
            with open(path, "w") as f:
                f.write(default_config)

    return path


def getLogFilePath():
    path = os.path.join(getGlobalFolderPath(), "continue.log")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def getSavedContextGroupsPath():
    path = os.path.join(getGlobalFolderPath(), "saved_context_groups.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write("\{\}")
    return path
