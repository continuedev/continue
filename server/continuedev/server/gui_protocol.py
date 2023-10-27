from ..core.main import SessionUpdate
from abc import ABC, abstractmethod


class AbstractGUIProtocolServer(ABC):
    @abstractmethod
    async def send_step_update(self, session_update: SessionUpdate):
        ...
