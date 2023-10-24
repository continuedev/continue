from typing import Optional

import typer

from . import run
from .server.main import run_server

app = typer.Typer()


CONTINUE_ASCII = r"""

_________               _____ _____                       
__  ____/______ _______ __  /____(_)_______ ____  _______ 
_  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
/ /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
\____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/ 

"""


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
        print(CONTINUE_ASCII)
        run_server(port=port, host=host, meilisearch_url=meilisearch_url)


if __name__ == "__main__":
    app()
