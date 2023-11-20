import os
import re
from typing import Awaitable, Callable, Optional

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


def getMigrationsPath():
    path = os.path.join(getGlobalFolderPath(), ".migrations")
    os.makedirs(path, exist_ok=True)
    return path


def hasMigrated(migration_id: str) -> bool:
    path = os.path.join(getMigrationsPath(), migration_id)
    return os.path.exists(path)


def markMigrated(migration_id: str):
    path = os.path.join(getMigrationsPath(), migration_id)
    with open(path, "w") as f:
        f.write("")


async def migrate(migration_id: str, migrate_func: Callable[[], Awaitable]):
    if not hasMigrated(migration_id):
        await migrate_func()
        markMigrated(migration_id)


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


def getEmbeddingsFolderPath():
    path = os.path.join(getGlobalFolderPath(), "embeddings")
    os.makedirs(path, exist_ok=True)
    return path


def decode_escaped_path(path: str) -> str:
    """We use a custom escaping scheme to record the full path of a file as a
    corresponding basename, but withut URL encoding, because then the URI just gets
    interpreted as a full path again."""
    return path.replace("_f_", "/").replace("_b_", "\\")


def encode_escaped_path(path: str) -> str:
    """We use a custom escaping scheme to record the full path of a file as a
    corresponding basename, but withut URL encoding, because then the URI just gets
    interpreted as a full path again."""
    return path.replace("/", "_f_").replace("\\", "_b_")


def getEmbeddingsPathForBranch(workspace_dir: str, branch_name: str):
    path = os.path.join(
        getEmbeddingsFolderPath(), encode_escaped_path(workspace_dir), branch_name
    )
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


def migrateConfigFile(existing: str) -> Optional[str]:
    if existing.strip() == "":
        return default_config

    migrated = (
        existing.replace("MaybeProxyOpenAI", "OpenAIFreeTrial")
        .replace("maybe_proxy_openai", "openai_free_trial")
        .replace("unused=", "saved=")
        .replace("medium=", "summarize=")
        .replace("TextGenUI", "TextGenWebUI")
        .replace("text_gen_interface", "text_gen_webui")
        .replace(".steps.chroma", ".steps.codebase")
        .replace("\xa0", " ")
        .replace("server_url", "api_base")
    )
    if migrated != existing:
        return migrated

    return None


def getConfigFilePath(json: bool = False) -> str:
    path = os.path.join(
        getGlobalFolderPath(), "config.py" if not json else "config.json"
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Until migration considered complete, don't do this for .json
    if not json:
        if not os.path.exists(path):
            with open(path, "w") as f:
                f.write(default_config)
        else:
            # Make any necessary migrations
            with open(path, "r") as f:
                existing_content = f.read()

            migrated = migrateConfigFile(existing_content)

            if migrated is not None:
                with open(path, "w") as f:
                    f.write(migrated)

    return path


def convertConfigImports(shorten: bool):
    path = getConfigFilePath()
    # Make any necessary migrations
    with open(path, "r") as f:
        existing_content = f.read()

    if shorten:
        migrated = existing_content.replace(
            "from continuedev.src.continuedev.", "from continuedev."
        )
    else:
        migrated = re.sub(
            r"(?<!src\.)continuedev\.(?!src)",
            "continuedev.",
            existing_content,
        )

    with open(path, "w") as f:
        f.write(migrated)


def getLogFilePath():
    path = os.path.join(getGlobalFolderPath(), "continue.log")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def getSavedContextGroupsPath():
    path = os.path.join(getGlobalFolderPath(), "saved_context_groups.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write("{}")
    return path
