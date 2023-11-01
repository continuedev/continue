from typing import Any, Dict, List, Optional, TypeVar
from ..core.observation import Observation
from pydantic import BaseModel, Field, validator


class WebsocketsMessage(BaseModel):
    message_id: str
    message_type: str
    data: Dict[str, Any]

    @classmethod
    def new(cls, message_type: str, data: Dict[str, Any]) -> "WebsocketsMessage":
        return cls(message_type=message_type, data=data)
