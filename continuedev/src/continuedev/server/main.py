import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .ide import router as ide_router
from .gui import router as gui_router
import logging
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
parser.add_argument("-p", "--port", help="server port", type=int, default=8000)
args = parser.parse_args()


# log_file = open('output.log', 'a')
# sys.stdout = log_file


def run_server():
    if os.path.exists("logging.yaml"):
        uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")
    else:
        uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")


if __name__ == "__main__":
    run_server()
