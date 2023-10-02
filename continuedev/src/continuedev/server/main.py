import argparse
import asyncio
import atexit
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..libs.util.create_async_task import create_async_task
from ..libs.util.logging import logger
from .gui import router as gui_router
from .ide import router as ide_router
from .meilisearch_server import start_meilisearch, stop_meilisearch
from .session_manager import router as sessions_router
from .session_manager import session_manager

meilisearch_url_global = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def on_err(e):
        logger.warning(f"Error starting MeiliSearch: {e}")

    try:
        # start meilisearch without blocking server startup
        create_async_task(start_meilisearch(url=meilisearch_url_global), on_err)
    except Exception as e:
        logger.warning(f"Error starting MeiliSearch: {e}")

    yield
    stop_meilisearch()


app = FastAPI(lifespan=lifespan)

app.include_router(ide_router)
app.include_router(gui_router)
app.include_router(sessions_router)

# Add CORS support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    logger.debug("Health check")
    return {"status": "ok"}


def run_server(
    port: int = 65432, host: str = "127.0.0.1", meilisearch_url: Optional[str] = None
):
    try:
        global meilisearch_url_global

        meilisearch_url_global = meilisearch_url

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
    logger.debug("------ Cleaning Up ------")
    for session_id in session_manager.sessions:
        await session_manager.persist_session(session_id)


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
