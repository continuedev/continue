from abc import abstractmethod, abstractproperty
from typing import List, Optional, Union

from ..models.filesystem import RangeInFileWithContents
from ..models.filesystem_edit import FileSystemEdit
from ..models.main import Range
from ..server.protocols.gui_protocol import AbstractGUIProtocolServer
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer
from .config import ContinueConfig
from .lsp import ContinueLSPClient
from .main import ChatMessage, Context, ContextItem, Step, StepDescription
from .models import Models


class AbstractContinueSDK:
    """The SDK provided as parameters to a step"""

    ide: AbstractIdeProtocolServer
    gui: AbstractGUIProtocolServer
    config: ContinueConfig
    models: Models

    lsp: Optional[ContinueLSPClient] = None
    context: Context = Context()

    @abstractproperty
    def history(self) -> List[StepDescription]:
        ...

    @abstractproperty
    def context_items(self) -> List[ContextItem]:
        ...

    @abstractmethod
    async def _ensure_absolute_path(self, path: str) -> str:
        ...

    @abstractmethod
    async def run_step(self, step: Step):
        ...

    @abstractmethod
    async def apply_filesystem_edit(
        self,
        edit: FileSystemEdit,
        name: str = "Filesystem Edit",
        description: str = "Filesystem Edit",
    ):
        ...

    @abstractmethod
    async def run(
        self,
        commands: Union[List[str], str],
        cwd: Optional[str] = None,
        name: str = "Run Command",
        description: str = "Run Command",
        handle_error: bool = True,
    ) -> str:
        ...

    @abstractmethod
    async def edit_file(
        self,
        filename: str,
        prompt: str,
        name: str = "Edit File",
        description: str = "",
        range: Optional[Range] = None,
    ):
        ...

    @abstractmethod
    async def append_to_file(self, filename: str, content: str):
        ...

    @abstractmethod
    async def add_file(self, filename: str, content: Union[str, None]):
        ...

    @abstractmethod
    async def delete_file(self, filename: str):
        ...

    @abstractmethod
    async def add_directory(self, path: str):
        ...

    @abstractmethod
    async def delete_directory(self, path: str):
        ...

    @abstractmethod
    async def get_code_context(
        self, only_editing: bool = False
    ) -> List[RangeInFileWithContents]:
        ...

    @abstractmethod
    async def add_context_item(self, item: ContextItem):
        ...

    @abstractmethod
    def set_loading_message(self, message: str):
        ...

    @abstractmethod
    def raise_exception(
        self, message: str, title: str, with_step: Union[Step, None] = None
    ):
        ...

    async def get_chat_context(self) -> List[ChatMessage]:
        ...

    @abstractmethod
    async def get_context_item_chat_messages(
        self, exclude: Optional[str] = None
    ) -> List[ChatMessage]:
        ...
