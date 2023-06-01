import json
from fastapi import Depends, Header, WebSocket, APIRouter
from typing import Any, Type, TypeVar, Union
from pydantic import BaseModel
from uvicorn.main import Server

from .session_manager import SessionManager, session_manager, Session
from .notebook_protocol import AbstractNotebookProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
import asyncio
import nest_asyncio
nest_asyncio.apply()

router = APIRouter(prefix="/notebook", tags=["notebook"])

# Graceful shutdown by closing websockets
original_handler = Server.handle_exit


class AppStatus:
    should_exit = False

    @staticmethod
    def handle_exit(*args, **kwargs):
        AppStatus.should_exit = True
        print("Shutting down")
        original_handler(*args, **kwargs)


Server.handle_exit = AppStatus.handle_exit


def session(x_continue_session_id: str = Header("anonymous")) -> Session:
    return session_manager.get_session(x_continue_session_id)


def websocket_session(session_id: str) -> Session:
    return session_manager.get_session(session_id)


T = TypeVar("T", bound=BaseModel)

# You should probably abstract away the websocket stuff into a separate class


class NotebookProtocolServer(AbstractNotebookProtocolServer):
    websocket: WebSocket
    session: Session
    sub_queue: AsyncSubscriptionQueue = AsyncSubscriptionQueue()

    def __init__(self, session: Session):
        self.session = session

    async def _send_json(self, message_type: str, data: Any):
        await self.websocket.send_json({
            "message_type": message_type,
            "data": data
        })

    async def _receive_json(self, message_type: str) -> Any:
        return await self.sub_queue.get(message_type)

    async def _send_and_receive_json(self, data: Any, resp_model: Type[T], message_type: str) -> T:
        await self._send_json(message_type, data)
        resp = await self._receive_json(message_type)
        return resp_model.parse_obj(resp)

    def handle_json(self, message_type: str, data: Any):
        try:
            if message_type == "main_input":
                self.on_main_input(data["input"])
            elif message_type == "step_user_input":
                self.on_step_user_input(data["input"], data["index"])
            elif message_type == "refinement_input":
                self.on_refinement_input(data["input"], data["index"])
            elif message_type == "reverse_to_index":
                self.on_reverse_to_index(data["index"])
        except Exception as e:
            print(e)

    async def send_state_update(self):
        state = self.session.agent.get_full_state().dict()
        await self._send_json("state_update", {
            "state": state
        })

    def on_main_input(self, input: str):
        # Do something with user input
        asyncio.create_task(self.session.agent.accept_user_input(input))

    def on_reverse_to_index(self, index: int):
        # Reverse the history to the given index
        asyncio.create_task(self.session.agent.reverse_to_index(index))

    def on_step_user_input(self, input: str, index: int):
        asyncio.create_task(
            self.session.agent.give_user_input(input, index))

    def on_refinement_input(self, input: str, index: int):
        asyncio.create_task(
            self.session.agent.accept_refinement_input(input, index))


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session: Session = Depends(websocket_session)):
    await websocket.accept()

    print("Session started")
    session_manager.register_websocket(session.session_id, websocket)
    protocol = NotebookProtocolServer(session)
    protocol.websocket = websocket

    # Update any history that may have happened before connection
    await protocol.send_state_update()

    while AppStatus.should_exit is False:
        message = await websocket.receive_text()
        print("Received message", message)
        if type(message) is str:
            message = json.loads(message)

        if "messageType" not in message or "data" not in message:
            continue
        message_type = message["messageType"]
        data = message["data"]

        protocol.handle_json(message_type, data)

    print("Closing websocket")
    await websocket.close()
