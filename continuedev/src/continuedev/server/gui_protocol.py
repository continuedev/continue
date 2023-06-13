from typing import Any, Dict, List
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

    @abstractmethod
    async def send_available_slash_commands(self, commands: List[Dict]):
        """Send a list of available slash commands to the client"""

    @abstractmethod
    def on_retry_at_index(self, index: int):
        """Called when the user requests a retry at a previous index"""

    @abstractmethod
    def on_clear_history(self):
        """Called when the user requests to clear the history"""

    @abstractmethod
    def on_delete_at_index(self, index: int):
        """Called when the user requests to delete a step at a given index"""
