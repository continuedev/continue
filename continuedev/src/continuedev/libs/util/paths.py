import os
from ..constants.main import CONTINUE_SESSIONS_FOLDER, CONTINUE_GLOBAL_FOLDER, CONTINUE_SERVER_FOLDER
from ..constants.default_config import default_config


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


def getSessionFilePath(session_id: str):
    path = os.path.join(getSessionsFolderPath(), f"{session_id}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def getConfigFilePath() -> str:
    path = os.path.join(getGlobalFolderPath(), "config.py")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not os.path.exists(path):
        with open(path, 'w') as f:
            f.write(default_config)
    else:
        with open(path, 'r') as f:
            existing_content = f.read()

        if existing_content.strip() == "":
            with open(path, 'w') as f:
                f.write(default_config)
        elif " continuedev.core" in existing_content:
            with open(path, 'w') as f:
                f.write(existing_content.replace(" continuedev.",
                                                 " continuedev.src.continuedev."))

    return path


def getLogFilePath():
    path = os.path.join(getGlobalFolderPath(), "continue.log")
    return path
