import argparse
import asyncio
import atexit

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..libs.util.logging import logger
from .gui import router as gui_router
from .ide import router as ide_router
from .session_manager import router as sessions_router
from .session_manager import session_manager

app = FastAPI()

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


def run_server(port: int = 65432, host: str = "127.0.0.1"):
    config = uvicorn.Config(app, host=host, port=port)
    server = uvicorn.Server(config)
    server.run()


async def cleanup_coroutine():
    logger.debug("Cleaning up sessions")
    for session_id in session_manager.sessions:
        await session_manager.persist_session(session_id)


def cleanup():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup_coroutine())
    loop.close()


atexit.register(cleanup)

if __name__ == "__main__":
    try:
        try:
            # add cli arg for server port
            parser = argparse.ArgumentParser()
            parser.add_argument(
                "-p", "--port", help="server port", type=int, default=65432
            )
            parser.add_argument(
                "--host", help="server host", type=str, default="127.0.0.1"
            )
            args = parser.parse_args()
        except Exception as e:
            logger.debug(f"Error parsing command line arguments: {e}")
            raise e

        run_server(args.port, args.host)
    except Exception as e:
        logger.debug(f"Error starting Continue server: {e}")
        cleanup()
        raise e
