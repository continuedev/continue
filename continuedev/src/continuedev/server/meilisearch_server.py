import os
import shutil
import subprocess

from meilisearch_python_async import Client
from ..libs.util.paths import getServerFolderPath


def ensure_meilisearch_installed():
    """
    Checks if MeiliSearch is installed.
    """
    serverPath = getServerFolderPath()
    meilisearchPath = os.path.join(serverPath, "meilisearch")
    dumpsPath = os.path.join(serverPath, "dumps")
    dataMsPath = os.path.join(serverPath, "data.ms")

    paths = [meilisearchPath, dumpsPath, dataMsPath]

    existing_paths = set()
    non_existing_paths = set()
    for path in paths:
        if os.path.exists(path):
            existing_paths.add(path)
        else:
            non_existing_paths.add(path)

    if len(non_existing_paths) > 0:
        # Clear the meilisearch binary
        if meilisearchPath in existing_paths:
            os.remove(meilisearchPath)
            non_existing_paths.remove(meilisearchPath)

        # Clear the existing directories
        for p in existing_paths:
            shutil.rmtree(p, ignore_errors=True)

        # Download MeiliSearch
        print("Downloading MeiliSearch...")
        subprocess.run(
            f"curl -L https://install.meilisearch.com | sh", shell=True, check=True, cwd=serverPath)


async def check_meilisearch_running() -> bool:
    """
    Checks if MeiliSearch is running.
    """

    try:
        client = Client('http://localhost:7700')
        resp = await client.health()
        if resp["status"] != "available":
            return False
        return True
    except Exception:
        return False


async def start_meilisearch():
    """
    Starts the MeiliSearch server, wait for it.
    """

    # Doesn't work on windows for now
    if not os.name == "posix":
        return

    serverPath = getServerFolderPath()

    # Check if MeiliSearch is installed, if not download
    ensure_meilisearch_installed()

    # Check if MeiliSearch is running
    if not await check_meilisearch_running():
        print("Starting MeiliSearch...")
        subprocess.Popen(["./meilisearch"], cwd=serverPath, stdout=subprocess.DEVNULL,
                         stderr=subprocess.STDOUT, close_fds=True, start_new_session=True)
