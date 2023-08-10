import asyncio
import os
import shutil
import subprocess

from meilisearch_python_async import Client

from ..libs.util.paths import getServerFolderPath
from ..libs.util.logging import logger


def ensure_meilisearch_installed() -> bool:
    """
    Checks if MeiliSearch is installed.

    Returns a bool indicating whether it was installed to begin with.
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
            existing_paths.remove(meilisearchPath)

        # Clear the existing directories
        for p in existing_paths:
            shutil.rmtree(p, ignore_errors=True)

        # Download MeiliSearch
        logger.debug("Downloading MeiliSearch...")
        subprocess.run(
            f"curl -L https://install.meilisearch.com | sh", shell=True, check=True, cwd=serverPath)

        return False

    return True


async def check_meilisearch_running() -> bool:
    """
    Checks if MeiliSearch is running.
    """

    try:
        async with Client('http://localhost:7700') as client:
            try:
                resp = await client.health()
                if resp.status != "available":
                    return False
                return True
            except Exception as e:
                logger.debug(e)
                return False
    except Exception:
        return False


async def poll_meilisearch_running(frequency: int = 0.1) -> bool:
    """
    Polls MeiliSearch to see if it is running.
    """
    while True:
        if await check_meilisearch_running():
            return True
        await asyncio.sleep(frequency)


async def start_meilisearch():
    """
    Starts the MeiliSearch server, wait for it.
    """

    # Doesn't work on windows for now
    if not os.name == "posix":
        return

    serverPath = getServerFolderPath()

    # Check if MeiliSearch is installed, if not download
    was_already_installed = ensure_meilisearch_installed()

    # Check if MeiliSearch is running
    if not await check_meilisearch_running() or not was_already_installed:
        logger.debug("Starting MeiliSearch...")
        subprocess.Popen(["./meilisearch", "--no-analytics"], cwd=serverPath, stdout=subprocess.DEVNULL,
                         stderr=subprocess.STDOUT, close_fds=True, start_new_session=True)
