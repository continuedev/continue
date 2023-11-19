import asyncio
import os
import re
import shutil
import signal
import subprocess
from typing import Optional

import aiofiles
import aiohttp
import psutil
from meilisearch_python_async import Client

from ..libs.util.logging import logger
from ..libs.util.paths import getMeilisearchExePath, getServerFolderPath
from .global_config import global_config


async def download_file(url: str, filename: str):
    async with aiohttp.ClientSession(trust_env=True) as session:
        async with session.get(url) as resp:
            if resp.status == 200:
                f = await aiofiles.open(filename, mode="wb")
                await f.write(await resp.read())
                await f.close()


async def download_meilisearch():
    """
    Downloads MeiliSearch.
    """

    serverPath = getServerFolderPath()

    if os.name == "nt":
        logger.debug("Downloading MeiliSearch for Windows...")
        download_url = "https://github.com/meilisearch/meilisearch/releases/download/v1.3.2/meilisearch-windows-amd64.exe"
        download_path = getMeilisearchExePath()
        if not os.path.exists(download_path):
            await download_file(download_url, download_path)
            # subprocess.run(
            #     f"curl -L {download_url} -o {download_path}",
            #     shell=True,
            #     check=True,
            #     cwd=serverPath,
            # )
    else:
        logger.debug("Downloading MeiliSearch with curl...")
        subprocess.run(
            "curl -L https://install.meilisearch.com | sh",
            shell=True,
            check=True,
            cwd=serverPath,
        )


async def ensure_meilisearch_installed() -> bool:
    """
    Checks if MeiliSearch is installed.

    Returns a bool indicating whether it was installed to begin with.
    """
    serverPath = getServerFolderPath()
    meilisearchPath = getMeilisearchExePath()
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
            try:
                os.remove(meilisearchPath)
            except Exception:
                pass
            existing_paths.remove(meilisearchPath)

        try:
            await asyncio.wait_for(download_meilisearch(), timeout=60)
        except asyncio.TimeoutError:
            logger.critical("Timed out trying to download MeiliSearch")

        # Clear the existing directories
        for p in existing_paths:
            shutil.rmtree(p, ignore_errors=True)

        return False

    return True


meilisearch_process = None
DEFAULT_MEILISEARCH_URL = "http://localhost:7700"
meilisearch_url = DEFAULT_MEILISEARCH_URL


def get_meilisearch_url():
    return meilisearch_url


async def check_meilisearch_running() -> bool:
    """
    Checks if MeiliSearch is running.
    """

    try:
        async with Client(meilisearch_url) as client:
            try:
                resp = await client.health()
                if resp.status != "available":
                    return False
                return True
            except Exception:
                return False
    except Exception:
        return False


async def poll_meilisearch_running(frequency: float = 0.1) -> bool:
    """
    Polls MeiliSearch to see if it is running.
    """
    while True:
        if await check_meilisearch_running():
            return True
        await asyncio.sleep(frequency)


async def start_meilisearch(url: Optional[str] = None):
    """
    Starts the MeiliSearch server, wait for it.
    """
    global meilisearch_process, meilisearch_url

    if url is not None:
        logger.debug("Using MeiliSearch at URL: " + url)
        meilisearch_url = url
        return

    if global_config.disable_meilisearch:
        logger.debug("MeiliSearch disabled")
        return

    serverPath = getServerFolderPath()

    # Check if MeiliSearch is installed, if not download
    was_already_installed = await ensure_meilisearch_installed()

    # Check if MeiliSearch is running
    if not await check_meilisearch_running() or not was_already_installed:
        logger.debug("Starting MeiliSearch...")
        binary_name = "meilisearch" if os.name == "nt" else "./meilisearch"
        meilisearch_process = subprocess.Popen(
            [binary_name, "--no-analytics"],
            cwd=serverPath,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            close_fds=True,
            start_new_session=True,
            shell=True,
        )

    logger.info(f"Meilisearch started at {meilisearch_url}")


def stop_meilisearch():
    """
    Stops the MeiliSearch server.
    """
    global meilisearch_process
    if meilisearch_process is not None:
        meilisearch_process.terminate()
        meilisearch_process.wait()
        meilisearch_process = None


def kill_proc(port):
    for proc in psutil.process_iter():
        try:
            for conns in proc.connections(kind="inet"):
                if conns.laddr.port == port:
                    proc.send_signal(signal.SIGKILL)
        except psutil.AccessDenied:
            logger.warning(f"Failed to kill process on port {port} (access denied)")
            return
        except psutil.ZombieProcess:
            logger.warning(f"Failed to kill process on port {port} (zombie process)")
            return
        except psutil.NoSuchProcess:
            logger.warning(f"Failed to kill process on port {port} (no such process)")
            return


async def restart_meilisearch():
    stop_meilisearch()
    kill_proc(7700)
    await start_meilisearch(url=global_config.meilisearch_url)


def remove_meilisearch_disallowed_chars(id: str) -> str:
    return re.sub(r"[^0-9a-zA-Z_-]", "", id)
