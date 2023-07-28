import asyncio
import sys
import time
import psutil
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import atexit
import uvicorn
import argparse
import logging.config


from .ide import router as ide_router
from .gui import router as gui_router
from .session_manager import session_manager
from ..libs.util.paths import getLogFilePath

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
    print("Health check")
    return {"status": "ok"}


class Logger(object):
    def __init__(self, log_file: str):
        self.terminal = sys.stdout
        self.log = open(log_file, "a")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        # this flush method is needed for python 3 compatibility.
        # this handles the flush command by doing nothing.
        # you might want to specify some extra behavior here.
        pass

    def isatty(self):
        return False


def setup_logging():
    log_path = getLogFilePath()
    LOG_CONFIG = {
        'version': 1,
        'disable_existing_loggers': False,
        'handlers': {
            'file': {
                'level': 'DEBUG',
                'class': 'logging.FileHandler',
                'filename': log_path,
            },
        },
        'root': {
            'level': 'DEBUG',
            'handlers': ['file']
        }
    }

    logger = Logger(log_path)
    print(f"Log path: {log_path}")
    # sys.stdout = logger
    # sys.stderr = logger
    print("Testing logs")


try:
    # add cli arg for server port
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", help="server port",
                        type=int, default=65432)
    args = parser.parse_args()
except Exception as e:
    print("Error parsing command line arguments: ", e)
    raise e


def run_server():
    config = uvicorn.Config(app, host="0.0.0.0", port=args.port,
                            # log_config=LOG_CONFIG
                            )
    server = uvicorn.Server(config)

    server.run()


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
        # Uncomment to get CPU usage reports
        # import threading

        # def cpu_usage_loop():
        #     while True:
        #         cpu_usage_report()
        #         time.sleep(2)

        # cpu_thread = threading.Thread(target=cpu_usage_loop)
        # cpu_thread.start()

        setup_logging()
        run_server()
    except Exception as e:
        print("Error starting Continue server: ", e)
        cleanup()
        raise e
