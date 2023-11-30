import os
from typing import Dict, Optional

from socketio import AsyncServer

from ..core.autopilot import Autopilot
from ..core.config import ContinueConfig, SerializedContinueConfig
from ..core.context import ContextManager
from ..core.main import SessionState
from ..libs.constants.default_config import default_config_json
from ..libs.index.build_index import build_index
from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.errors import format_exc
from ..libs.util.logging import logger
from ..libs.util.paths import getConfigFilePath, getDiffsFolderPath, migrate
from ..libs.util.telemetry import posthog_logger
from ..plugins.context_providers.file import FileContextProvider
from ..plugins.context_providers.highlighted_code import HighlightedCodeContextProvider
from ..plugins.steps.on_traceback import DefaultOnTracebackStep
from .protocols.gui import GUIProtocolServer
from .protocols.ide import IdeProtocolServer, WindowInfo


class Window:
    ide: Optional[IdeProtocolServer] = None
    gui: Optional[GUIProtocolServer] = None
    config: ContinueConfig
    context_manager: ContextManager = ContextManager()

    _error_loading_config: Optional[str] = None
    _last_valid_config: Optional[ContinueConfig] = None

    def load_config(self) -> ContinueConfig:
        # Create necessary directories
        getDiffsFolderPath()

        try:
            return ContinueConfig.load_default()
        except Exception as e:
            self._error_loading_config = format_exc(e)
            logger.error(f"Failed to load config.py: {self._error_loading_config}")

            return (
                ContinueConfig()
                if self._last_valid_config is None
                else self._last_valid_config
            )

    def __init__(self, config: Optional[ContinueConfig] = None) -> None:
        self.config = config or self.load_config() or ContinueConfig()

    def get_autopilot(self, session_state: SessionState) -> Optional[Autopilot]:
        if self.ide is None or self.gui is None or self.config is None:
            return None

        return Autopilot(
            session_state=session_state,
            ide=self.ide,
            gui=self.gui,
            config=self.config,
            context_manager=self.context_manager,
        )

    def get_config(self) -> Optional[ContinueConfig]:
        return self.config

    def is_closed(self) -> bool:
        return self.ide is None and self.gui is None

    async def reload_config(self):
        self.config = self.load_config()

    async def display_config_error(self):
        if self._error_loading_config is not None:
            if not os.path.exists(getConfigFilePath(json=True)):
                with open(getConfigFilePath(json=True), "w") as f:
                    f.write(default_config_json)

            if self.ide is not None:
                await self.ide.setFileOpen(getConfigFilePath(json=True))
                await self.ide.showMessage(
                    f"""We found an error while loading your config.py. For now, Continue is falling back to the default configuration. If you need help solving this error, please reach out to us on Discord by clicking the question mark button in the bottom right.\n\n{self._error_loading_config}"""
                )

                self._error_loading_config = None

    async def on_error(self, e: Exception):
        if self.ide is not None:
            await self.ide.on_error(e)

    async def load(
        self, config: Optional[ContinueConfig] = None, only_reloading: bool = False
    ):
        if self.ide is None:
            return

        async def migrate_fn():
            if self.ide is not None:
                await self.ide.setFileOpen(getConfigFilePath(json=True))

        await migrate(
            "config_json_001",
            migrate_fn,
        )

        # Need a non-step way of sending a notification to the GUI. Fine to be displayed similarly

        # formatted_err = "\n".join(traceback.format_exception(e, e, e.__traceback__))
        # msg_step = MessageStep(
        #     name="Invalid Continue Config File", message=formatted_err
        # )
        # msg_step.description = f"Falling back to default config settings due to the following error in `~/.continue/config.py`.\n```\n{formatted_err}\n```\n\nIt's possible this was caused by an update to the Continue config format. If you'd like to see the new recommended default `config.py`, check [here](https://github.com/continuedev/continue/blob/main/server/continuedev/libs/constants/default_config.py)."
        # self.history.add_node(
        #     HistoryNode(step=msg_step, observation=None, depth=0, active=False)
        # )

        await self.display_config_error()

        async def index():
            if (
                self.ide is not None
                and self.gui is not None
                and self.config is not None
                and not self.config.disable_indexing
            ):
                async for progress in build_index(self.ide, self.config):
                    if self.gui is not None:
                        await self.gui.send_indexing_progress(progress)

        create_async_task(index(), on_error=self.on_error)

        # When the config is loaded, setup posthog logger
        posthog_logger.setup(
            self.ide.window_info.unique_id,
            self.config.allow_anonymous_telemetry,
            self.ide.ide_info,
        )
        dev_data_logger.setup(self.config.user_token, self.config.data_server_url)

        # Load documents into the search index
        await self.context_manager.start(
            self.config.context_providers
            + [
                HighlightedCodeContextProvider(ide=self.ide),
                FileContextProvider(workspace_dir=self.ide.workspace_directory),
            ],
            self.ide,
            only_reloading=only_reloading,
            disable_indexing=self.config.disable_indexing,
        )

        async def onFileSavedCallback(filepath: str, contents: str):
            if (
                filepath.endswith(".continue/config.py")
                or filepath.endswith(".continue\\config.py")
                or filepath.endswith(".continue/config.json")
                or filepath.endswith(".continue\\config.json")
            ):
                await self.reload_config()
                if self.gui is not None:
                    await self.gui.send_config_update()

                await self.display_config_error()

        self.ide.subscribeToFileSaved(onFileSavedCallback)

        async def onDebugCallback(terminal_contents: str):
            if self.gui is not None:
                # Does this really work though? Because you need to give the correct index
                print("Debugging terminal")
                session_state = await self.gui.get_session_state()
                await self.gui.run_from_state(
                    session_state, DefaultOnTracebackStep(output=terminal_contents)
                )

        self.ide.subscribeToDebugTerminal(onDebugCallback)

        def onTelemetryChangeCallback(enabled: bool):
            self.config.allow_anonymous_telemetry = enabled
            SerializedContinueConfig.set_telemetry_enabled(enabled)

        self.ide.subscribeToTelemetryEnabled(onTelemetryChangeCallback)

        # # Subscribe to highlighted code, pass to the context manager
        # def onHighlightedCodeCallback(
        #     range_in_files: List[RangeInFileWithContents], edit: bool
        # ):
        #     if "file" in self.context_manager.context_providers:
        #         self.context_manager.context_providers["file"].get_context_item
        #         await self.gui.add_context_item(item)

        # self.ide.subscribeToHighlightedCode(onHighlightedCodeCallback)

        # Load saved context groups
        # context_groups_file = getSavedContextGroupsPath()
        # try:
        #     with open(context_groups_file, "r") as f:
        #         json_ob = json.load(f)
        #         for title, context_group in json_ob.items():
        #             self._saved_context_groups[title] = [
        #                 ContextItem(**item) for item in context_group
        #             ]
        # except Exception as e:
        #     logger.warning(
        #         f"Failed to load saved_context_groups.json: {e}. Reverting to empty list."
        #     )
        #     self._saved_context_groups = {}
        # self._saved_context_groups = {}

    # async def reload_config(self):
    #     await self.load(config=None, only_reloading=True)


class WindowManager:
    # window_id to Window
    windows: Dict[str, Window] = {}

    # sid to ide/gui
    guis: Dict[str, GUIProtocolServer] = {}
    ides: Dict[str, IdeProtocolServer] = {}

    def get_window(self, sid: str) -> Window:
        return self.windows[sid]

    def get_ide(self, sid: str) -> Optional[IdeProtocolServer]:
        return self.ides.get(sid)

    async def register_ide(self, window_info: WindowInfo, sio: AsyncServer, sid: str):
        if window_info.window_id not in self.windows:
            self.windows[window_info.window_id] = Window()

        ide = IdeProtocolServer(window_info, sio, sid)
        self.windows[window_info.window_id].ide = ide
        self.ides[sid] = ide

        if self.windows[window_info.window_id].gui is not None:
            await self.windows[window_info.window_id].load()
            logger.info(f"There are {len(self.windows)} sessions currently open")

    def remove_ide(self, sid: str):
        ide = self.ides.pop(sid, None)
        if ide is None:
            return

        if window := self.windows.get(ide.window_info.window_id):
            window.ide = None
            if window.is_closed():
                del self.windows[ide.window_info.window_id]

    def get_gui(self, sid: str) -> Optional[GUIProtocolServer]:
        return self.guis.get(sid)

    async def register_gui(self, window_id: str, sio, sid: str):
        if window_id not in self.windows:
            self.windows[window_id] = Window()

        async def open_config():
            ide = self.windows[window_id].ide
            if ide is not None:
                await ide.setFileOpen(getConfigFilePath(json=True))

        gui = GUIProtocolServer(
            window_id=window_id,
            sio=sio,
            sid=sid,
            get_autopilot=self.windows[window_id].get_autopilot,
            get_context_item=self.windows[window_id].context_manager.get_context_item,
            get_config=self.windows[window_id].get_config,
            reload_config=self.windows[window_id].reload_config,
            open_config=open_config,
        )
        self.windows[window_id].gui = gui
        self.guis[sid] = gui

        if self.windows[window_id].ide is not None:
            await self.windows[window_id].load()
            logger.info(f"There are {len(self.windows)} sessions currently open")

    def remove_gui(self, sid: str):
        gui = self.guis.pop(sid, None)
        if gui is None:
            return

        if window := self.windows.get(gui.window_id):
            window.gui = None
            if window.is_closed():
                del self.windows[gui.window_id]


window_manager = WindowManager()
