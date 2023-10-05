from typing import Optional

import typer

from . import run
from .server.main import run_server

app = typer.Typer()


@app.command()
def main(
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


if __name__ == "__main__":
    app()
