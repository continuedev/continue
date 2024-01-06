from typing import Any, Dict

from pydantic import BaseModel


class WebsocketsMessage(BaseModel):
    message_id: str
    message_type: str
    data: Dict[str, Any]
