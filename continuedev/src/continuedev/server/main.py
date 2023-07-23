import asyncio
import subprocess
import time
import meilisearch
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
from .meilisearch_server import start_meilisearch

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
    print("Testing")
    return {"status": "ok"}


# add cli arg for server port
parser = argparse.ArgumentParser()
parser.add_argument("-p", "--port", help="server port",
                    type=int, default=65432)
args = parser.parse_args()


# log_file = open('output.log', 'a')
# sys.stdout = log_file

def run_server():
    uvicorn.run(app, host="0.0.0.0", port=args.port)


async def cleanup_coroutine():
    print("Cleaning up sessions")
    for session_id in session_manager.sessions:
        await session_manager.persist_session(session_id)


def cleanup():
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup_coroutine())
    loop.close()


def cpu_usage_report():
    process = psutil.Process(os.getpid())
    # Call cpu_percent once to start measurement, but ignore the result
    process.cpu_percent(interval=None)
    # Wait for a short period of time
    time.sleep(1)
    # Call cpu_percent again to get the CPU usage over the interval
    cpu_usage = process.cpu_percent(interval=None)
    print(f"CPU usage: {cpu_usage}%")


atexit.register(cleanup)

if __name__ == "__main__":
    try:
        # import threading

        # def cpu_usage_loop():
        #     while True:
        #         cpu_usage_report()
        #         time.sleep(2)

        # cpu_thread = threading.Thread(target=cpu_usage_loop)
        # cpu_thread.start()

        try:
            start_meilisearch()
        except Exception as e:
            print("Failed to start MeiliSearch")
            print(e)

        run_server()
    except Exception as e:
        cleanup()
        raise e
