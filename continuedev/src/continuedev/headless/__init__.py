import asyncio
from typing import Optional, Union

import typer

from ..core.config import ContinueConfig
from ..server.session_manager import Session, session_manager
from .headless_ide import LocalIdeProtocol

app = typer.Typer()


async def start_headless_session(
    config: Optional[Union[str, ContinueConfig]] = None
) -> Session:
    if config is not None:
        if isinstance(config, str):
            config: ContinueConfig = ContinueConfig.from_filepath(config)

    ide = LocalIdeProtocol()
    return await session_manager.new_session(ide, config=config)


async def async_main(config: Optional[str] = None):
    await start_headless_session(config=config)


@app.command()
def main(
    config: Optional[str] = typer.Option(
        None, help="The path to the configuration file"
    )
):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(async_main(config))
    tasks = asyncio.all_tasks(loop)
    loop.run_until_complete(asyncio.gather(*tasks))


if __name__ == "__main__":
    app()
