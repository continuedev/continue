from typing import List

from ...core.main import ContextItem, SessionUpdate
from .gui_protocol import AbstractGUIProtocolServer


class CommandLineGUI(AbstractGUIProtocolServer):
    async def send_session_update(self, session_update: SessionUpdate):
        if hasattr(session_update.update, "description"):
            print(session_update.update.description)  # type: ignore

    async def send_indexing_progress(self, progress: float):
        print(f"Indexing... {int(progress*100)}%")

    context_items: List[ContextItem] = []

    async def add_context_item(self, item: ContextItem):
        self.context_items.append(item)
        print(f"Added context item {item.description}")
