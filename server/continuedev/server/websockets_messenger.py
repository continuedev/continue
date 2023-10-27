import asyncio
from typing import Any, Dict, Optional, Type, TypeVar
import uuid
from ..core.main import ContinueCustomException

from fastapi.websockets import WebSocketState
from pydantic import BaseModel
from ..models.websockets import WebsocketsMessage
from fastapi import WebSocket
from ..libs.util.queue import WebsocketsSubscriptionQueue
from ..libs.util.logging import logger

T = TypeVar("T", bound=BaseModel)


class WebsocketsMessenger:
    websocket: WebSocket
    sub_queue: WebsocketsSubscriptionQueue = WebsocketsSubscriptionQueue()

    def __init__(self, ws: WebSocket):
        self.ws = ws

    async def send(
        self, message_type: str, data: Dict[str, Any], message_id: Optional[str] = None
    ):
        msg = WebsocketsMessage(
            message_type=message_type,
            data=data,
            message_id=message_id or uuid.uuid4().hex,
        )
        try:
            if self.websocket.application_state == WebSocketState.DISCONNECTED:
                logger.debug(
                    f"Tried to send message, but websocket is disconnected: {msg.message_type}"
                )
                return

            await self.websocket.send_json(msg.dict())
        except RuntimeError as e:
            logger.warning(f"Error sending message, websocket probably closed: {e}")

    async def receive(self, message_id: str) -> WebsocketsMessage:
        resp = await self.sub_queue.get(message_id)
        await self.sub_queue.delete(message_id)
        return resp

    async def send_and_receive(
        self, data: Dict[str, Any], resp_model: Type[T], message_type: str
    ) -> T:
        message_id = uuid.uuid4().hex

        async def try_with_timeout(timeout: int):
            await self.send(message_type, data, message_id=message_id)
            resp = await asyncio.wait_for(self.receive(message_id), timeout=timeout)
            return resp_model.parse_obj(resp.data)

        timeout = 1.0
        while True:
            try:
                return await try_with_timeout(timeout)
            except asyncio.TimeoutError:
                timeout *= 1.5
                if timeout > 10:
                    raise ContinueCustomException(
                        title=f"Timed out waiting for response to '{message_type}'",
                        message=f"Timed out waiting for response to '{message_type}'. The message sent was: {data or ''}",
                    )

    def post_to_queue(self, msg: WebsocketsMessage):
        self.sub_queue.post(msg)
