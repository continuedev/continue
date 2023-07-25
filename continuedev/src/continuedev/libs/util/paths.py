import os

from ..constants.main import CONTINUE_SESSIONS_FOLDER, CONTINUE_GLOBAL_FOLDER, CONTINUE_SERVER_FOLDER


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


def getDefaultConfigFile() -> str:
    current_path = os.path.dirname(os.path.realpath(__file__))
    config_path = os.path.join(
        current_path, "..", "constants", "default_config.py.txt")
    with open(config_path, 'r') as f:
        return f.read()


def getConfigFilePath() -> str:
    path = os.path.join(getGlobalFolderPath(), "config.py")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not os.path.exists(path):
        with open(path, 'w') as f:
            f.write(getDefaultConfigFile())

    return path
