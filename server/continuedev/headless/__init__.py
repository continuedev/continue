from typing import List, Optional, Union

from ..core.autopilot import Autopilot
from ..core.config.config import ContinueConfig
from ..core.context import ContextManager, ContextProvider
from ..core.main import SessionState
from ..server.protocols.cli_gui import CommandLineGUI
from .headless_ide import LocalIdeProtocol


async def get_headless_autopilot(
    directory: Optional[str] = ".",
    state: Optional[SessionState] = None,
    config: Optional[Union[str, ContinueConfig]] = None,
    context_providers: List[ContextProvider] = [],
) -> Autopilot:
    if config is not None:
        if isinstance(config, str):
            config: ContinueConfig = ContinueConfig.from_filepath(config)
    else:
        config = ContinueConfig.load_default()

    ide = LocalIdeProtocol(workspace_directory=directory)
    context_manager = ContextManager()
    # await context_manager.start(context_providers=context_providers, ide=ide)
    await config.models.start(
        "HEADLESS", config.system_message, config.completion_options.temperature
    )

    return Autopilot(
        session_state=state,
        ide=ide,
        gui=CommandLineGUI(),
        config=config,
        context_manager=context_manager,
    )
