import asyncio
from typing import Union

from .core.config import ContinueConfig
from .core.main import Step

# from .headless import start_headless_session


def run(step_or_config: Union[Step, ContinueConfig, str]):
    if isinstance(step_or_config, ContinueConfig):
        config = step_or_config
    elif isinstance(step_or_config, str):
        config = ContinueConfig.from_filepath(step_or_config)
    else:
        config = ContinueConfig()
        config.steps_on_startup = [step_or_config]

    loop = asyncio.get_event_loop()
    # loop.run_until_complete(start_headless_session(config=config))
    tasks = asyncio.all_tasks(loop)
    loop.run_until_complete(asyncio.gather(*tasks))
