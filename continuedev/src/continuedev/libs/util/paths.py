import os

from ..constants.main import CONTINUE_SESSIONS_FOLDER, CONTINUE_GLOBAL_FOLDER, CONTINUE_SERVER_FOLDER

def getGlobalFolderPath():
    return os.path.join(os.path.expanduser("~"), CONTINUE_GLOBAL_FOLDER)



def getSessionsFolderPath():
    return os.path.join(getGlobalFolderPath(), CONTINUE_SESSIONS_FOLDER)

def getServerFolderPath():
    return os.path.join(getGlobalFolderPath(), CONTINUE_SERVER_FOLDER)

def getSessionFilePath(session_id: str):
    return os.path.join(getSessionsFolderPath(), f"{session_id}.json")