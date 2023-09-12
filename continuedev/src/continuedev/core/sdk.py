import os
import traceback
from typing import Coroutine, List, Optional, Union

from ..libs.llm import LLM
from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.logging import logger
from ..libs.util.paths import getConfigFilePath, getDiffsFolderPath
from ..libs.util.telemetry import posthog_logger
from ..models.filesystem import RangeInFile
from ..models.filesystem_edit import (
    AddDirectory,
    AddFile,
    DeleteDirectory,
    DeleteFile,
    FileEdit,
    FileSystemEdit,
)
from ..models.main import Range
from ..plugins.steps.core.core import (
    DefaultModelEditCodeStep,
    FileSystemEditStep,
    MessageStep,
    RangeInFileWithContents,
    ShellCommandsStep,
    WaitForUserConfirmationStep,
)
from ..server.ide_protocol import AbstractIdeProtocolServer
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig
from .lsp import ContinueLSPClient
from .main import (
    ChatMessage,
    Context,
    ContinueCustomException,
    History,
    HistoryNode,
    Step,
)
from .models import Models
from .observation import Observation


class Autopilot:
    pass


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""

    ide: AbstractIdeProtocolServer
    models: Models
    lsp: Optional[ContinueLSPClient] = None
    context: Context
    config: ContinueConfig
    __autopilot: Autopilot

    def __init__(self, autopilot: Autopilot):
        self.ide = autopilot.ide
        self.__autopilot = autopilot
        self.context = autopilot.context

    @classmethod
    async def create(
        cls, autopilot: Autopilot, config: Optional[ContinueConfig] = None
    ) -> "ContinueSDK":
        sdk = ContinueSDK(autopilot)
        autopilot.continue_sdk = sdk

        # Create necessary directories
        getDiffsFolderPath()

        try:
            sdk.config = config or sdk._load_config_dot_py()
        except Exception as e:
            logger.error(f"Failed to load config.py: {traceback.format_exception(e)}")

            sdk.config = (
                ContinueConfig()
                if sdk._last_valid_config is None
                else sdk._last_valid_config
            )

            formatted_err = "\n".join(traceback.format_exception(e))
            msg_step = MessageStep(
                name="Invalid Continue Config File", message=formatted_err
            )
            msg_step.description = f"Falling back to default config settings due to the following error in `~/.continue/config.py`.\n```\n{formatted_err}\n```\n\nIt's possible this was caused by an update to the Continue config format. If you'd like to see the new recommended default `config.py`, check [here](https://github.com/continuedev/continue/blob/main/continuedev/src/continuedev/libs/constants/default_config.py).\n\nIf the error is related to OpenAIServerInfo, see the updated way of using these parameters [here](https://continue.dev/docs/customization#azure-openai-service)."
            sdk.history.add_node(
                HistoryNode(step=msg_step, observation=None, depth=0, active=False)
            )
            await sdk.ide.setFileOpen(getConfigFilePath())

        # Start models
        sdk.models = sdk.config.models
        await sdk.models.start(sdk)

        # Start LSP
        async def start_lsp():
            try:
                sdk.lsp = ContinueLSPClient(
                    workspace_dir=sdk.ide.workspace_directory,
                )
                await sdk.lsp.start()
            except Exception as e:
                logger.warning(f"Failed to start LSP client: {e}", exc_info=True)
                sdk.lsp = None

        create_async_task(
            start_lsp(), on_error=lambda e: logger.error("Failed to setup LSP: %s", e)
        )

        # When the config is loaded, setup posthog logger
        posthog_logger.setup(sdk.ide.unique_id, sdk.config.allow_anonymous_telemetry)
        dev_data_logger.setup(sdk.config.user_token, sdk.config.data_server_url)

        return sdk

    @property
    def history(self) -> History:
        return self.__autopilot.history

    def write_log(self, message: str):
        self.history.timeline[self.history.current_index].logs.append(message)

    async def start_model(self, llm: LLM):
        await llm.start(unique_id=self.ide.unique_id, write_log=self.write_log)

    async def _ensure_absolute_path(self, path: str) -> str:
        if os.path.isabs(path):
            return path

        # Else if in workspace
        workspace_path = os.path.join(self.ide.workspace_directory, path)
        if os.path.exists(workspace_path):
            return workspace_path
        else:
            # Check if it matches any of the open files, then use that absolute path
            open_files = await self.ide.getOpenFiles()
            for open_file in open_files:
                if os.path.basename(open_file) == os.path.basename(path):
                    return open_file
            raise Exception(f"Path {path} does not exist")

    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        return await self.__autopilot._run_singular_step(step)

    async def apply_filesystem_edit(
        self, edit: FileSystemEdit, name: str = None, description: str = None
    ):
        return await self.run_step(
            FileSystemEditStep(
                edit=edit, description=description, **({"name": name} if name else {})
            )
        )

    async def wait_for_user_input(self) -> str:
        return await self.__autopilot.wait_for_user_input()

    async def wait_for_user_confirmation(self, prompt: str):
        return await self.run_step(WaitForUserConfirmationStep(prompt=prompt))

    async def run(
        self,
        commands: Union[List[str], str],
        cwd: str = None,
        name: str = None,
        description: str = None,
        handle_error: bool = True,
    ) -> Coroutine[str, None, None]:
        commands = commands if isinstance(commands, List) else [commands]
        return (
            await self.run_step(
                ShellCommandsStep(
                    cmds=commands,
                    cwd=cwd,
                    description=description,
                    handle_error=handle_error,
                    **({"name": name} if name else {}),
                )
            )
        ).text

    async def edit_file(
        self,
        filename: str,
        prompt: str,
        name: str = None,
        description: str = "",
        range: Range = None,
    ):
        filepath = await self._ensure_absolute_path(filename)

        await self.ide.setFileOpen(filepath)
        contents = await self.ide.readFile(filepath)
        await self.run_step(
            DefaultModelEditCodeStep(
                range_in_files=[
                    RangeInFile(filepath=filepath, range=range)
                    if range is not None
                    else RangeInFile.from_entire_file(filepath, contents)
                ],
                user_input=prompt,
                description=description,
                **({"name": name} if name else {}),
            )
        )

    async def append_to_file(self, filename: str, content: str):
        filepath = await self._ensure_absolute_path(filename)
        previous_content = await self.ide.readFile(filepath)
        file_edit = FileEdit.from_append(filepath, previous_content, content)
        await self.ide.applyFileSystemEdit(file_edit)

    async def add_file(self, filename: str, content: Union[str, None]):
        filepath = await self._ensure_absolute_path(filename)
        dir_name = os.path.dirname(filepath)
        os.makedirs(dir_name, exist_ok=True)
        return await self.run_step(
            FileSystemEditStep(edit=AddFile(filepath=filepath, content=content))
        )

    async def delete_file(self, filename: str):
        filename = await self._ensure_absolute_path(filename)
        return await self.run_step(
            FileSystemEditStep(edit=DeleteFile(filepath=filename))
        )

    async def add_directory(self, path: str):
        path = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=AddDirectory(path=path)))

    async def delete_directory(self, path: str):
        path = await self._ensure_absolute_path(path)
        return await self.run_step(FileSystemEditStep(edit=DeleteDirectory(path=path)))

    _last_valid_config: ContinueConfig = None

    def _load_config_dot_py(self) -> ContinueConfig:
        path = getConfigFilePath()
        config = ContinueConfig.from_filepath(path)
        self._last_valid_config = config

        logger.debug("Loaded Continue config file from %s", path)

        return config

    def get_code_context(
        self, only_editing: bool = False
    ) -> List[RangeInFileWithContents]:
        highlighted_ranges = self.__autopilot.context_manager.context_providers[
            "code"
        ].highlighted_ranges
        context = (
            list(filter(lambda x: x.item.editing, highlighted_ranges))
            if only_editing
            else highlighted_ranges
        )
        return [c.rif for c in context]

    def set_loading_message(self, message: str):
        # self.__autopilot.set_loading_message(message)
        raise NotImplementedError()

    def raise_exception(
        self, message: str, title: str, with_step: Union[Step, None] = None
    ):
        raise ContinueCustomException(message, title, with_step)

    async def get_chat_context(self) -> List[ChatMessage]:
        history_context = self.history.to_chat_history()

        context_messages: List[
            ChatMessage
        ] = await self.__autopilot.context_manager.get_chat_messages()

        # Insert at the end, but don't insert after latest user message or function call
        for msg in context_messages:
            history_context.insert(-1, msg)

        return history_context

    async def update_ui(self):
        await self.__autopilot.update_subscribers()

    async def clear_history(self):
        await self.__autopilot.clear_history()

    def current_step_was_deleted(self):
        return self.history.timeline[self.history.current_index].deleted
