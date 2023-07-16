import asyncio
import json
from fastapi import Depends, Header, WebSocket, APIRouter
from starlette.websockets import WebSocketState, WebSocketDisconnect
from typing import Any, List, Type, TypeVar, Union
from pydantic import BaseModel
import traceback
from uvicorn.main import Server

from .session_manager import SessionManager, session_manager, Session
from .gui_protocol import AbstractGUIProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..libs.util.telemetry import capture_event
from ..libs.util.create_async_task import create_async_task

router = APIRouter(prefix="/gui", tags=["gui"])

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


async def session(x_continue_session_id: str = Header("anonymous")) -> Session:
    return await session_manager.get_session(x_continue_session_id)


async def websocket_session(session_id: str) -> Session:
    return await session_manager.get_session(session_id)


T = TypeVar("T", bound=BaseModel)

# You should probably abstract away the websocket stuff into a separate class


class GUIProtocolServer(AbstractGUIProtocolServer):
    websocket: WebSocket
    session: Session
    sub_queue: AsyncSubscriptionQueue = AsyncSubscriptionQueue()

    def __init__(self, session: Session):
        self.session = session

    async def _send_json(self, message_type: str, data: Any):
        if self.websocket.application_state == WebSocketState.DISCONNECTED:
            return
        await self.websocket.send_json({
            "messageType": message_type,
            "data": data
        })

    async def _receive_json(self, message_type: str, timeout: int = 5) -> Any:
        try:
            return await asyncio.wait_for(self.sub_queue.get(message_type), timeout=timeout)
        except asyncio.TimeoutError:
            raise Exception(
                "GUI Protocol _receive_json timed out after 5 seconds")

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
            elif message_type == "retry_at_index":
                self.on_retry_at_index(data["index"])
            elif message_type == "change_default_model":
                self.on_change_default_model(data["model"])
            elif message_type == "clear_history":
                self.on_clear_history()
            elif message_type == "delete_at_index":
                self.on_delete_at_index(data["index"])
            elif message_type == "delete_context_at_indices":
                self.on_delete_context_at_indices(data["indices"])
            elif message_type == "toggle_adding_highlighted_code":
                self.on_toggle_adding_highlighted_code()
            elif message_type == "set_editing_at_indices":
                self.on_set_editing_at_indices(data["indices"])
            elif message_type == "set_pinned_at_indices":
                self.on_set_pinned_at_indices(data["indices"])
        except Exception as e:
            print(e)

    async def send_state_update(self):
        state = self.session.autopilot.get_full_state().dict()
        await self._send_json("state_update", {
            "state": state
        })

    def on_main_input(self, input: str):
        # Do something with user input
        create_async_task(self.session.autopilot.accept_user_input(
            input), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_reverse_to_index(self, index: int):
        # Reverse the history to the given index
        create_async_task(self.session.autopilot.reverse_to_index(
            index), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_step_user_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.give_user_input(input, index), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_refinement_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.accept_refinement_input(input, index), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_retry_at_index(self, index: int):
        create_async_task(
            self.session.autopilot.retry_at_index(index), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_change_default_model(self, model: str):
        create_async_task(self.session.autopilot.change_default_model(
            model), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_clear_history(self):
        create_async_task(self.session.autopilot.clear_history(
        ), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_delete_at_index(self, index: int):
        create_async_task(self.session.autopilot.delete_at_index(
            index), self.session.autopilot.continue_sdk.ide.unique_id)

    def on_delete_context_at_indices(self, indices: List[int]):
        create_async_task(
            self.session.autopilot.delete_context_at_indices(
                indices), self.session.autopilot.continue_sdk.ide.unique_id
        )

    def on_toggle_adding_highlighted_code(self):
        create_async_task(
            self.session.autopilot.toggle_adding_highlighted_code(
            ), self.session.autopilot.continue_sdk.ide.unique_id
        )

    def on_set_editing_at_indices(self, indices: List[int]):
        create_async_task(
            self.session.autopilot.set_editing_at_indices(
                indices), self.session.autopilot.continue_sdk.ide.unique_id
        )

    def on_set_pinned_at_indices(self, indices: List[int]):
        create_async_task(
            self.session.autopilot.set_pinned_at_indices(
                indices), self.session.autopilot.continue_sdk.ide.unique_id
        )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session: Session = Depends(websocket_session)):
    try:
        print("Received websocket connection at url: ", websocket.url)
        await websocket.accept()

        print("Session started")
        session_manager.register_websocket(session.session_id, websocket)
        protocol = GUIProtocolServer(session)
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
    except WebSocketDisconnect as e:
        print("GUI websocket disconnected")
    except Exception as e:
        print("ERROR in gui websocket: ", e)
        capture_event(session.autopilot.continue_sdk.ide.unique_id, "gui_error", {
                      "error_title": e.__str__() or e.__repr__(), "error_message": '\n'.join(traceback.format_exception(e))})
        raise e
    finally:
        print("Closing gui websocket")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()

        session_manager.persist_session(session.session_id)
        session_manager.remove_session(session.session_id)
