import os
import subprocess

import meilisearch
from ..libs.util.paths import getServerFolderPath


def check_meilisearch_installed() -> bool:
    """
    Checks if MeiliSearch is installed.
    """

    serverPath = getServerFolderPath()
    meilisearchPath = os.path.join(serverPath, "meilisearch")

    return os.path.exists(meilisearchPath)


def check_meilisearch_running() -> bool:
    """
    Checks if MeiliSearch is running.
    """

    try:
        client = meilisearch.Client('http://localhost:7700')
        resp = client.health()
        if resp["status"] != "available":
            return False
        return True
    except Exception:
        return False


def start_meilisearch():
    """
    Starts the MeiliSearch server, wait for it.
    """

    # Doesn't work on windows for now
    if not os.name == "posix":
        return

    serverPath = getServerFolderPath()

    # Check if MeiliSearch is installed
    if not check_meilisearch_installed():
        # Download MeiliSearch
        print("Downloading MeiliSearch...")
        subprocess.run(
            f"curl -L https://install.meilisearch.com | sh", shell=True, check=True, cwd=serverPath)

    # Check if MeiliSearch is running
    if not check_meilisearch_running():
        print("Starting MeiliSearch...")
        subprocess.Popen(["./meilisearch"], cwd=serverPath, stdout=subprocess.DEVNULL,
                         stderr=subprocess.STDOUT, close_fds=True, start_new_session=True)
