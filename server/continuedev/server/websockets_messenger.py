import asyncio
import json
import uuid
from typing import Any, Dict, Optional, Type, TypeVar

from fastapi import WebSocket
from fastapi.websockets import WebSocketState
from pydantic import BaseModel
from socketio import AsyncServer

from ..core.main import ContinueCustomException
from ..libs.util.logging import logger
from ..libs.util.queue import WebsocketsSubscriptionQueue
from ..models.websockets import WebsocketsMessage

T = TypeVar("T", bound=BaseModel)


class SocketIOMessenger:
    sio: AsyncServer
    sid: str

    futures: Dict[str, asyncio.Future] = {}

    def __init__(self, sio: AsyncServer, sid: str):
        self.sio = sio
        self.sid = sid

    async def send(
        self,
        message_type: str,
        data: Dict[str, Any],
        message_id: Optional[str] = None,
        callback=None,
    ):
        def empty_callback(*args):
            pass

        if callback is None:
            # If not set, the protocol sends a different message
            # and the client won't get an ack object
            callback = empty_callback

        msg = WebsocketsMessage(
            message_type=message_type,
            data=data,
            message_id=message_id or uuid.uuid4().hex,
        )
        await self.sio.send(msg.dict(), to=self.sid, callback=callback)

    async def receive(self, message_id: str) -> WebsocketsMessage:
        if message_id not in self.futures:
            self.futures[message_id] = asyncio.Future()

        return await self.futures[message_id]

    async def send_and_receive(
        self, data: Dict[str, Any], resp_model: Type[T], message_type: str
    ) -> T:
        message_id = uuid.uuid4().hex

        async def try_with_timeout(timeout: float):
            fut = asyncio.Future()

            def callback(ack_data):
                fut.set_result(ack_data)

            await self.send(
                message_type, data, message_id=message_id, callback=callback
            )
            response = await fut
            if isinstance(response, str):
                response = json.loads(response)

            return resp_model.parse_obj(response["data"])

            # await self.send(message_type, data, message_id=message_id)
            # resp = await asyncio.wait_for(self.receive(message_id), timeout=timeout)
            # return resp_model.parse_obj(resp.data)

        timeout = 1.0
        while True:
            try:
                return await try_with_timeout(timeout)
            except asyncio.TimeoutError:
                print(f"Timed out waiting for response to '{message_type}'")
                timeout *= 1.5
                if timeout > 10:
                    raise ContinueCustomException(
                        title=f"Timed out waiting for response to '{message_type}'",
                        message=f"Timed out waiting for response to '{message_type}'. The message sent was: {data or ''}",
                    )
            except asyncio.exceptions.CancelledError:
                print(f"Cancelled task {message_type}")

    def post(self, msg: WebsocketsMessage):
        if msg.message_id in self.futures:
            self.futures[msg.message_id].set_result(msg)
            del self.futures[msg.message_id]


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

        async def try_with_timeout(timeout: float):
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

    def post(self, msg: WebsocketsMessage):
        self.sub_queue.post(msg)
