import asyncio
import os
from abc import ABC
from typing import List, Optional, Union

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
from ..plugins.context_providers.highlighted_code import HighlightedCodeContextProvider
from ..server.protocols.gui_protocol import AbstractGUIProtocolServer
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer
from .abstract_sdk import AbstractContinueSDK
from .config import ContinueConfig
from .context import ContextManager
from .lsp import ContinueLSPClient
from .main import (
    ChatMessage,
    Context,
    ContextItem,
    ContinueCustomException,
    SessionState,
    Step,
    StepDescription,
)
from .models import Models
from .steps import (
    DefaultModelEditCodeStep,
    FileSystemEditStep,
    RangeInFileWithContents,
    ShellCommandsStep,
)


class Autopilot(ABC):
    session_state: SessionState
    ide: AbstractIdeProtocolServer
    gui: AbstractGUIProtocolServer
    config: ContinueConfig
    context_manager: ContextManager

    context: Context = Context()

    async def run_step(self, step: Step):
        ...


class ContinueSDK(AbstractContinueSDK):
    """The SDK provided as parameters to a step"""

    ide: AbstractIdeProtocolServer
    gui: AbstractGUIProtocolServer
    config: ContinueConfig
    models: Models

    lsp: Optional[ContinueLSPClient] = None
    context: Context = Context()

    __autopilot: Autopilot

    def __init__(
        self,
        config: ContinueConfig,
        ide: AbstractIdeProtocolServer,
        gui: AbstractGUIProtocolServer,
        autopilot: Autopilot,
    ):
        self.ide = ide
        self.gui = gui
        self.config = config
        self.models = config.construct_models()
        self.models.start(
            self.ide.window_info.unique_id,
            self.config.system_message,
            self.config.completion_options.temperature,
        )
        self.__autopilot = autopilot

    @property
    def history(self) -> List[StepDescription]:
        return self.__autopilot.session_state.history

    @property
    def context_items(self) -> List[ContextItem]:
        return self.__autopilot.session_state.context_items

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

    async def run_step(self, step: Step):
        await self.__autopilot.run_step(step)

    async def apply_filesystem_edit(
        self,
        edit: FileSystemEdit,
        name: str = "Filesystem Edit",
        description: str = "Filesystem Edit",
    ):
        return await self.run_step(
            FileSystemEditStep(edit=edit, description=description, name=name)
        )

    async def run(
        self,
        commands: Union[List[str], str],
        cwd: Optional[str] = None,
        name: str = "Run Command",
        description: str = "Run Command",
        handle_error: bool = True,
    ):
        commands = commands if isinstance(commands, List) else [commands]
        await self.run_step(
            ShellCommandsStep(
                cmds=commands,
                cwd=cwd,
                description=description,
                handle_error=handle_error,
                name=name,
            )
        )  # TODO: Return the output

    async def edit_file(
        self,
        filename: str,
        prompt: str,
        name: str = "Edit File",
        description: str = "",
        range: Optional[Range] = None,
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
                name=name,
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
            FileSystemEditStep(edit=AddFile(filepath=filepath, content=content or ""))
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

    async def get_code_context(
        self, only_editing: bool = False
    ) -> List[RangeInFileWithContents]:
        editing = filter(
            lambda x: x.editable and (x.editing or not only_editing), self.context_items
        )
        return await asyncio.gather(
            *[
                HighlightedCodeContextProvider.get_range_in_file_with_contents(
                    self.ide, item
                )
                for item in editing
            ]
        )

    async def add_context_item(self, item: ContextItem):
        self.__autopilot.session_state.context_items.append(item)
        await self.gui.add_context_item(item)

    def set_loading_message(self, message: str):
        # self.__autopilot.set_loading_message(message)
        raise NotImplementedError()

    def raise_exception(
        self, message: str, title: str, with_step: Union[Step, None] = None
    ):
        raise ContinueCustomException(message, title, with_step)

    async def get_chat_context(self) -> List[ChatMessage]:
        msgs = []

        for step in filter(lambda x: x.hide is False, self.history):
            role = "assistant"
            if step.step_type == "UserInputStep":
                role = "user"
                msgs.extend(
                    await self.__autopilot.context_manager.get_chat_messages(
                        [ContextItem(**itm) for itm in step.params["context_items"]]
                    )
                )

            msgs.append(
                ChatMessage(
                    role=role,
                    name=step.step_type,
                    content=step.description or f"Ran function {step.name}",
                    summary=f"Called function {step.name}",
                )
            )

        return msgs

    async def get_context_item_chat_messages(
        self, exclude: Optional[str] = None
    ) -> List[ChatMessage]:
        return await self.__autopilot.context_manager.get_chat_messages(
            # list(
            # filter(
            # lambda x: x.description,
            self.context_items
            # )
            # )
        )
