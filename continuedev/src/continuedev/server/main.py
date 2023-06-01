import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .ide import router as ide_router
from .notebook import router as notebook_router
import uvicorn
import argparse

app = FastAPI()

app.include_router(ide_router)
app.include_router(notebook_router)

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
    return {"status": "ok"}


# add cli arg for server port
parser = argparse.ArgumentParser()
parser.add_argument("-p", "--port", help="server port", type=int, default=8000)
args = parser.parse_args()


def run_server():
    if os.path.exists("logging.yaml"):
        uvicorn.run(app, host="0.0.0.0", port=args.port,
                    log_config="logging.yaml")
    else:
        uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    run_server()
