import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .ide import router as ide_router
from .gui import router as gui_router
from .session_manager import session_manager
import atexit
import uvicorn
import argparse

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


def cleanup():
    print("Cleaning up sessions")
    for session_id in session_manager.sessions:
        session_manager.persist_session(session_id)


atexit.register(cleanup)
if __name__ == "__main__":
    try:
        run_server()
    except Exception as e:
        cleanup()
        raise e
