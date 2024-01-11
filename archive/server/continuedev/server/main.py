import argparse
import asyncio
import atexit
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ..core.config import ContinueConfig
from ..core.main import ContextProviderDescription, SlashCommandDescription
from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.logging import logger
from .global_config import global_config
from .gui import router as gui_router
from .gui import sio_gui_app
from .ide import router as ide_router
from .ide import sio_ide_app
from .meilisearch_server import start_meilisearch, stop_meilisearch
from .sessions import router as sessions_router


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

app.mount("/ide", sio_ide_app, name="ide")
app.mount("/gui", sio_gui_app, name="gui")

# Add CORS support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# region: Base endpoints

try:
    root_config = ContinueConfig.load_default()
except Exception as e:
    logger.error(f"Failed to load config.py: {e}")
    root_config = ContinueConfig()


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


class FeedbackBody(BaseModel):
    type: str
    prompt: str
    completion: str
    feedback: bool


@app.post("/feedback")
def feedback(body: FeedbackBody):
    dev_data_logger.capture("feedback", body.dict())


# endregion


async def cleanup_coroutine():
    logger.debug("------ End logs ------")


def cleanup():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup_coroutine())
    loop.close()


def run_server(
    port: int = 65432,
    host: str = "127.0.0.1",
    meilisearch_url: Optional[str] = None,
    disable_meilisearch: bool = False,
):
    try:
        global global_config
        global_config.meilisearch_url = meilisearch_url
        global_config.disable_meilisearch = disable_meilisearch

        logger.debug("------ Begin Logs ------")
        atexit.register(cleanup)

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
