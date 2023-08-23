import asyncio
from typing import Optional

import typer

from .src.continuedev.core.config import ContinueConfig
from .src.continuedev.headless.headless_ide import LocalIdeProtocol
from .src.continuedev.plugins.policies.headless import HeadlessPolicy
from .src.continuedev.server.session_manager import session_manager

app = typer.Typer()


async def async_main(config: Optional[str] = None):
    if config is not None:
        config: ContinueConfig = ContinueConfig.from_filepath(config)
        config.policy_override = HeadlessPolicy(command="echo hi")

    ide = LocalIdeProtocol()
    await session_manager.new_session(ide, config=config)


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
