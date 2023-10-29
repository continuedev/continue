from ...models.websockets import WebsocketsMessage
from ...core.main import SessionUpdate
from abc import ABC, abstractmethod


class AbstractGUIProtocolServer(ABC):
    window_id: str

    @abstractmethod
    async def send_step_update(self, session_update: SessionUpdate):
        ...

    @abstractmethod
    async def handle_json(self, msg: WebsocketsMessage):
        """Handle a json message"""
