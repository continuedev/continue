import asyncio
import time
import psutil
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import atexit
import uvicorn
import argparse


from .ide import router as ide_router
from .gui import router as gui_router
from .session_manager import session_manager
from ..libs.util.logging import logger

app = FastAPI()

app.include_router(ide_router)
app.include_router(gui_router)

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


try:
    # add cli arg for server port
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", help="server port",
                        type=int, default=65432)
    args = parser.parse_args()
except Exception as e:
    logger.debug(f"Error parsing command line arguments: {e}")
    raise e


def run_server():
    config = uvicorn.Config(app, host="127.0.0.1", port=args.port)
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
        run_server()
    except Exception as e:
        logger.debug(f"Error starting Continue server: {e}")
        cleanup()
        raise e
