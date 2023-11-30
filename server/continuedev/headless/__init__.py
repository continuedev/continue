from typing import List, Optional, Union

from ..core.autopilot import Autopilot
from ..core.config import ContinueConfig
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
            _config: ContinueConfig = ContinueConfig.from_filepath(config)
        else:
            _config = config
    else:
        _config = ContinueConfig.load_default()

    ide = LocalIdeProtocol(workspace_directory=directory)
    context_manager = ContextManager()
    # await context_manager.start(context_providers=context_providers, ide=ide)
    # await _config.models.start(
    #     "HEADLESS", _config.system_message, _config.completion_options.temperature
    # )

    return Autopilot(
        session_state=state or SessionState.from_empty(),
        ide=ide,
        gui=CommandLineGUI(),
        config=_config,
        context_manager=context_manager,
    )
