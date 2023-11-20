import asyncio
import os
from typing import Optional

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from tqdm import tqdm

from . import run
from .core.config import ContinueConfig, RetrievalSettings
from .headless import get_headless_autopilot
from .headless.headless_ide import LocalIdeProtocol
from .libs.index.build_index import build_index
from .libs.index.chunkers.chunk import Chunk
from .libs.index.pipelines.main import main_retrieval_pipeline
from .libs.util.ext_to_lang import ext_to_lang
from .libs.util.paths import getConfigFilePath
from .server.main import run_server

load_dotenv()
app = typer.Typer(invoke_without_command=True)

console = Console()


CONTINUE_ASCII = r"""

_________               _____ _____                       
__  ____/______ _______ __  /____(_)_______ ____  _______ 
_  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
/ /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
\____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/ 

"""


def main_command(
    port: int = typer.Option(65432, help="server port"),
    host: str = typer.Option("127.0.0.1", help="server host"),
    meilisearch_url: Optional[str] = typer.Option(
        None, help="The URL of the MeiliSearch server if running manually"
    ),
    disable_meilisearch: bool = typer.Option(
        False, help="Disable the MeiliSearch server"
    ),
    config: Optional[str] = typer.Option(
        None, help="The path to the configuration file"
    ),
    headless: bool = typer.Option(False, help="Run in headless mode"),
):
    if headless:
        run(config or getConfigFilePath())
    else:
        print(CONTINUE_ASCII)
        run_server(
            port=port,
            host=host,
            meilisearch_url=meilisearch_url,
            disable_meilisearch=disable_meilisearch,
        )


@app.callback()
def main(
    ctx: typer.Context,
    port: int = typer.Option(65432, help="server port"),
    host: str = typer.Option("127.0.0.1", help="server host"),
    meilisearch_url: Optional[str] = typer.Option(
        None, help="The URL of the MeiliSearch server if running manually"
    ),
    disable_meilisearch: bool = typer.Option(
        False, help="Disable the MeiliSearch server"
    ),
    config: Optional[str] = typer.Option(
        None, help="The path to the configuration file"
    ),
    headless: bool = typer.Option(False, help="Run in headless mode"),
):
    if ctx.invoked_subcommand is None:
        main_command(
            port=port,
            host=host,
            meilisearch_url=meilisearch_url,
            config=config,
            headless=headless,
            disable_meilisearch=disable_meilisearch,
        )


def print_chunk(chunk: Chunk):
    # A nice colored representation of the piece of the file
    language = ext_to_lang(chunk.document_id.split(".")[-1])
    console.print(
        Markdown(
            f"\n**{chunk.document_id}**\n\n```{language}\n{chunk.content}\n```\n---\n"
        )
    )


@app.command()
def search(
    query: str = typer.Argument(..., help="The query to search for"),
    config: Optional[str] = typer.Option(
        None, "--config", help="The path to the configuration file"
    ),
    directory: str = typer.Option(None, "--directory", help="The directory to index"),
):
    if directory is None:
        directory = "."

    print(f"Searching {directory}...")

    # Make absolute
    directory = os.path.abspath(directory)

    async def run():
        autopilot = await get_headless_autopilot(config=config, directory=directory)

        results = await main_retrieval_pipeline(
            query,
            autopilot.sdk,
            openai_api_key=None,  # os.environ.get("OPENAI_API_KEY"),
        )

        console.print(Markdown(f"## Results for `{query}`"))
        for result in results:
            print_chunk(result)

    asyncio.run(run())


@app.command()
def index(
    directory: str = typer.Argument(None, help="The directory to index"),
    config: Optional[str] = typer.Option(
        None, help="The path to the configuration file"
    ),
    openai_api_key: Optional[str] = typer.Option(
        None, help="The OpenAI API key to use for indexing"
    ),
):
    if directory is None:
        directory = "."

    # Make absolute
    directory = os.path.abspath(directory)

    print(f"Indexing {directory}...")

    async def run():
        nonlocal config
        config_obj = None
        if config is None:
            config_obj = ContinueConfig.load_default()
        else:
            config_obj = ContinueConfig.from_filepath(config)

        if config_obj.retrieval_settings is None:
            config_obj.retrieval_settings = RetrievalSettings()

        config_obj.retrieval_settings.openai_api_key = openai_api_key

        pbar = tqdm(total=100)
        async for progress in build_index(
            ide=LocalIdeProtocol(workspace_directory=directory), config=config_obj
        ):
            pbar.update(int(progress * 100) - pbar.n)

        pbar.close()
        print("Indexing complete")

    asyncio.run(run())


if __name__ == "__main__":
    app()
