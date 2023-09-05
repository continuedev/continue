from abc import ABC, abstractmethod
from typing import Coroutine, List, Union

from ..models.filesystem_edit import FileSystemEdit
from .config import ContinueConfig
from .main import ChatMessage, History, Step
from .observation import Observation

"""
[[Generate]]
[Prompt]
Write an abstract class AbstractContinueSDK(ABC) that has all of the same methods as the ContinueSDK class, but without any implementation.
All methods should be documented with the same docstrings as the ContinueSDK class and have the same types.
[Context]
./sdk.py:ContinueSDK
"""


class AbstractContinueSDK(ABC):
    """The SDK provided as parameters to a step"""

    @property
    def history(self) -> History:
        return self.__autopilot.history

    @abstractmethod
    async def _ensure_absolute_path(self, path: str) -> str:
        pass

    @abstractmethod
    async def run_step(self, step: Step) -> Coroutine[Observation, None, None]:
        pass

    @abstractmethod
    async def apply_filesystem_edit(self, edit: FileSystemEdit):
        pass

    @abstractmethod
    async def wait_for_user_input(self) -> str:
        pass

    @abstractmethod
    async def wait_for_user_confirmation(self, prompt: str):
        pass

    @abstractmethod
    async def run(self, commands: Union[List[str], str], cwd: str = None):
        pass

    @abstractmethod
    async def edit_file(self, filename: str, prompt: str):
        pass

    @abstractmethod
    async def append_to_file(self, filename: str, content: str):
        pass

    @abstractmethod
    async def add_file(self, filename: str, content: Union[str, None]):
        pass

    @abstractmethod
    async def delete_file(self, filename: str):
        pass

    @abstractmethod
    async def add_directory(self, path: str):
        pass

    @abstractmethod
    async def delete_directory(self, path: str):
        pass

    config: ContinueConfig

    @abstractmethod
    def set_loading_message(self, message: str):
        pass

    @abstractmethod
    async def get_chat_context(self) -> List[ChatMessage]:
        pass
