from abc import ABC, abstractmethod

from ...core.main import ContextItem, SessionUpdate


class AbstractGUIProtocolServer(ABC):
    window_id: str

    @abstractmethod
    async def send_session_update(self, session_update: SessionUpdate):
        ...

    @abstractmethod
    async def add_context_item_at_index(self, item: ContextItem, index: int):
        ...
