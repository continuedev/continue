import asyncio
import os
from typing import Optional

from .libs.util.ext_to_lang import ext_to_lang
from .libs.index.chunkers.chunk import Chunk
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown

import typer

from . import run
from .server.main import run_server
from .headless import start_headless_session
from .plugins.steps.chroma import CreateCodebaseIndexChroma
from .libs.index.pipelines.main import main_retrieval_pipeline

load_dotenv()
app = typer.Typer(invoke_without_command=True)

console = Console()


def main_command(
    port: int = typer.Option(65432, help="server port"),
    host: str = typer.Option("127.0.0.1", help="server host"),
    meilisearch_url: Optional[str] = typer.Option(
        None, help="The URL of the MeiliSearch server if running manually"
    ),
    config: Optional[str] = typer.Option(
        None, help="The path to the configuration file"
    ),
    headless: bool = typer.Option(False, help="Run in headless mode"),
):
    if headless:
        run(config)
    else:
        run_server(port=port, host=host, meilisearch_url=meilisearch_url)


@app.callback()
def main(
    ctx: typer.Context,
    port: int = typer.Option(65432, help="server port"),
    host: str = typer.Option("127.0.0.1", help="server host"),
    meilisearch_url: Optional[str] = typer.Option(
        None, help="The URL of the MeiliSearch server if running manually"
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
        session = await start_headless_session(config, directory=directory)

        results = await main_retrieval_pipeline(
            query,
            session.autopilot.continue_sdk,
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
        session = await start_headless_session(config, directory=directory)
        await session.autopilot.run_from_step(
            CreateCodebaseIndexChroma(openai_api_key=openai_api_key)
        )

    asyncio.run(run())


if __name__ == "__main__":
    app()
