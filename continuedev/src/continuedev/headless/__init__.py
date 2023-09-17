import asyncio
from typing import Optional, Union

import typer

from ..core.config import ContinueConfig
from ..core.main import Step
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


def run_step_headless(step: Step):
    config = ContinueConfig()
    config.steps_on_startup = [step]

    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_headless_session(config=config))
    tasks = asyncio.all_tasks(loop)
    loop.run_until_complete(asyncio.gather(*tasks))
