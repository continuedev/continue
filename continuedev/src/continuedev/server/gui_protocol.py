from typing import Any
from abc import ABC, abstractmethod


class AbstractGUIProtocolServer(ABC):
    @abstractmethod
    async def handle_json(self, data: Any):
        """Handle a json message"""

    @abstractmethod
    def on_main_input(self, input: str):
        """Called when the user inputs something"""

    @abstractmethod
    def on_reverse_to_index(self, index: int):
        """Called when the user requests reverse to a previous index"""

    @abstractmethod
    def on_refinement_input(self, input: str, index: int):
        """Called when the user inputs a refinement"""

    @abstractmethod
    def on_step_user_input(self, input: str, index: int):
        """Called when the user inputs a step"""

    @abstractmethod
    async def send_state_update(self, state: dict):
        """Send a state update to the client"""
