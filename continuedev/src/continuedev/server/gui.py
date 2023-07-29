import asyncio
import json
from fastapi import Depends, Header, WebSocket, APIRouter
from starlette.websockets import WebSocketState, WebSocketDisconnect
from typing import Any, List, Type, TypeVar
from pydantic import BaseModel
import traceback
from uvicorn.main import Server

from .session_manager import session_manager, Session
from ..plugins.steps.core.core import DisplayErrorStep, MessageStep
from .gui_protocol import AbstractGUIProtocolServer
from ..libs.util.queue import AsyncSubscriptionQueue
from ..libs.util.telemetry import posthog_logger
from ..libs.util.create_async_task import create_async_task
from ..libs.util.logging import logger

router = APIRouter(prefix="/gui", tags=["gui"])

# Graceful shutdown by closing websockets
original_handler = Server.handle_exit


class AppStatus:
    should_exit = False

    @staticmethod
    def handle_exit(*args, **kwargs):
        AppStatus.should_exit = True
        logger.debug("Shutting down")
        original_handler(*args, **kwargs)


Server.handle_exit = AppStatus.handle_exit


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

    async def _receive_json(self, message_type: str, timeout: int = 20) -> Any:
        try:
            return await asyncio.wait_for(self.sub_queue.get(message_type), timeout=timeout)
        except asyncio.TimeoutError:
            raise Exception(
                "GUI Protocol _receive_json timed out after 20 seconds")

    async def _send_and_receive_json(self, data: Any, resp_model: Type[T], message_type: str) -> T:
        await self._send_json(message_type, data)
        resp = await self._receive_json(message_type)
        return resp_model.parse_obj(resp)

    def on_error(self, e: Exception):
        return self.session.autopilot.continue_sdk.run_step(DisplayErrorStep(e=e))

    def handle_json(self, message_type: str, data: Any):
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
        elif message_type == "clear_history":
            self.on_clear_history()
        elif message_type == "delete_at_index":
            self.on_delete_at_index(data["index"])
        elif message_type == "delete_context_with_ids":
            self.on_delete_context_with_ids(data["ids"])
        elif message_type == "toggle_adding_highlighted_code":
            self.on_toggle_adding_highlighted_code()
        elif message_type == "set_editing_at_indices":
            self.on_set_editing_at_indices(data["indices"])
        elif message_type == "show_logs_at_index":
            self.on_show_logs_at_index(data["index"])
        elif message_type == "select_context_item":
            self.select_context_item(data["id"], data["query"])

    def on_main_input(self, input: str):
        # Do something with user input
        create_async_task(
            self.session.autopilot.accept_user_input(input), self.on_error)

    def on_reverse_to_index(self, index: int):
        # Reverse the history to the given index
        create_async_task(
            self.session.autopilot.reverse_to_index(index), self.on_error)

    def on_step_user_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.give_user_input(input, index), self.on_error)

    def on_refinement_input(self, input: str, index: int):
        create_async_task(
            self.session.autopilot.accept_refinement_input(input, index), self.on_error)

    def on_retry_at_index(self, index: int):
        create_async_task(
            self.session.autopilot.retry_at_index(index), self.on_error)

    def on_clear_history(self):
        create_async_task(
            self.session.autopilot.clear_history(), self.on_error)

    def on_delete_at_index(self, index: int):
        create_async_task(
            self.session.autopilot.delete_at_index(index), self.on_error)

    def on_delete_context_with_ids(self, ids: List[str]):
        create_async_task(
            self.session.autopilot.delete_context_with_ids(ids), self.on_error)

    def on_toggle_adding_highlighted_code(self):
        create_async_task(
            self.session.autopilot.toggle_adding_highlighted_code(), self.on_error)

    def on_set_editing_at_indices(self, indices: List[int]):
        create_async_task(
            self.session.autopilot.set_editing_at_indices(indices), self.on_error)

    def on_show_logs_at_index(self, index: int):
        name = f"continue_logs.txt"
        logs = "\n\n############################################\n\n".join(
            ["This is a log of the exact prompt/completion pairs sent/received from the LLM during this step"] + self.session.autopilot.continue_sdk.history.timeline[index].logs)
        create_async_task(
            self.session.autopilot.ide.showVirtualFile(name, logs), self.on_error)

    def select_context_item(self, id: str, query: str):
        """Called when user selects an item from the dropdown"""
        create_async_task(
            self.session.autopilot.select_context_item(id, query), self.on_error)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session: Session = Depends(websocket_session)):
    try:
        logger.debug(f"Received websocket connection at url: {websocket.url}")
        await websocket.accept()

        logger.debug("Session started")
        session_manager.register_websocket(session.session_id, websocket)
        protocol = GUIProtocolServer(session)
        protocol.websocket = websocket

        # Update any history that may have happened before connection
        await protocol.session.autopilot.update_subscribers()

        while AppStatus.should_exit is False:
            message = await websocket.receive_text()
            logger.debug(f"Received GUI message {message}")
            if type(message) is str:
                message = json.loads(message)

            if "messageType" not in message or "data" not in message:
                continue
            message_type = message["messageType"]
            data = message["data"]

            protocol.handle_json(message_type, data)
    except WebSocketDisconnect as e:
        logger.debug("GUI websocket disconnected")
    except Exception as e:
        # Log, send to PostHog, and send to GUI
        logger.debug(f"ERROR in gui websocket: {e}")
        err_msg = '\n'.join(traceback.format_exception(e))
        posthog_logger.capture_event("gui_error", {
            "error_title": e.__str__() or e.__repr__(), "error_message": err_msg})

        await protocol.session.autopilot.continue_sdk.run_step(DisplayErrorStep(e=e))

        raise e
    finally:
        logger.debug("Closing gui websocket")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()

        await session_manager.persist_session(session.session_id)
        await session_manager.remove_session(session.session_id)
