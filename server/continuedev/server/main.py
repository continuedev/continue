import argparse
import asyncio
import atexit
from contextlib import asynccontextmanager
from typing import List, Optional

from ..core.main import ContextProviderDescription, SlashCommandDescription
from ..core.config import ContinueConfig

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..libs.util.create_async_task import create_async_task
from ..libs.util.logging import logger
from .gui import router as gui_router, sio_gui_app
from .ide import router as ide_router, sio_ide_app
from .sessions import router as sessions_router
from .meilisearch_server import start_meilisearch, stop_meilisearch
from .global_config import global_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def on_err(e):
        logger.warning(f"Error starting MeiliSearch: {e}")

    try:
        # start meilisearch without blocking server startup
        create_async_task(start_meilisearch(url=global_config.meilisearch_url), on_err)
    except Exception as e:
        logger.warning(f"Error starting MeiliSearch: {e}")

    yield
    stop_meilisearch()


app = FastAPI(lifespan=lifespan)

app.include_router(ide_router)
app.include_router(gui_router)
app.include_router(sessions_router)

app.mount("/ide", sio_ide_app)
app.mount("/gui", sio_gui_app)

# Add CORS support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# region: Base endpoints

root_config = ContinueConfig.load_default()


@app.get("/slash_commands")
def get_slash_commands() -> List[SlashCommandDescription]:
    return root_config.get_slash_command_descriptions()


@app.get("/context_providers")
def get_context_providers() -> List[ContextProviderDescription]:
    return root_config.get_context_provider_descriptions()


@app.get("/health")
def health():
    logger.debug("Health check")
    return {"status": "ok"}


# endregion


def run_server(
    port: int = 65432, host: str = "127.0.0.1", meilisearch_url: Optional[str] = None
):
    try:
        global global_config
        global_config.meilisearch_url = meilisearch_url

        config = uvicorn.Config(app, host=host, port=port)
        server = uvicorn.Server(config)
        server.run()
    except PermissionError as e:
        logger.critical(
            f"Error starting Continue server: {e}. "
            f"This means that port {port} is already in use, and is usually caused by another instance of the Continue server already running."
        )
        cleanup()
        raise e

    except Exception as e:
        logger.critical(f"Error starting Continue server: {e}")
        cleanup()
        raise e


async def cleanup_coroutine():
    logger.debug("------ End logs ------")


def cleanup():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup_coroutine())
    loop.close()


atexit.register(cleanup)

if __name__ == "__main__":
    try:
        # add cli arg for server port
        parser = argparse.ArgumentParser()
        parser.add_argument("-p", "--port", help="server port", type=int, default=65432)
        parser.add_argument("--host", help="server host", type=str, default="127.0.0.1")
        args = parser.parse_args()
    except Exception as e:
        logger.critical(f"Error parsing command line arguments: {e}")
        raise e

    run_server(args.port, args.host)
