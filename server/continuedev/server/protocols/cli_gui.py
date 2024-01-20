from typing import List

from ...core.main import ContextItem, SessionUpdate
from .gui_protocol import AbstractGUIProtocolServer


class CommandLineGUI(AbstractGUIProtocolServer):
    async def send_session_update(self, session_update: SessionUpdate) -> None:
        if hasattr(session_update.update, "description"):
            pass

    async def send_indexing_progress(self, progress: float) -> None:
        pass

    context_items: List[ContextItem] = []

    async def add_context_item(self, item: ContextItem) -> None:
        self.context_items.append(item)
