from typing import Any, List, Tuple, Union
from fastapi import WebSocket
from pydantic import BaseModel
from ..core.main import FullState

# State updates represented as (path, replacement) pairs
StateUpdate = Tuple[List[Union[str, int]], Any]


class StateManager:
    """
    A class that acts as the source of truth for state, ingesting changes to the entire object and streaming only the updated portions to client.
    """

    def __init__(self, ws: WebSocket):
        self.ws = ws

    def _send_update(self, updates: List[StateUpdate]):
        self.ws.send_json(
            [update.dict() for update in updates]
        )
