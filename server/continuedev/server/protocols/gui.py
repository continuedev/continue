import uuid
from typing import Awaitable, Callable, Dict, List, Optional, TypeVar

import socketio
from pydantic import BaseModel

from ...core.autopilot import Autopilot
from ...core.config import ContinueConfig, ModelDescription, SerializedContinueConfig
from ...core.main import (
    ContextItem,
    DeltaStep,
    SessionState,
    SessionUpdate,
    Step,
    StepDescription,
)
from ...libs.util.telemetry import posthog_logger
from ...libs.util.types import AsyncFunc
from ...models.websockets import WebsocketsMessage
from ..websockets_messenger import SocketIOMessenger
from .gui_protocol import AbstractGUIProtocolServer

T = TypeVar("T", bound=BaseModel)


class GUIProtocolServer(AbstractGUIProtocolServer):
    window_id: str
    messenger: SocketIOMessenger

    get_autopilot: Callable[[SessionState], Optional[Autopilot]]
    get_context_item: Callable[[str, str], Awaitable[Optional[ContextItem]]]
    get_config: Callable[[], Optional[ContinueConfig]]
    reload_config: AsyncFunc
    open_config: Callable[[], Awaitable[None]]

    def __init__(
        self,
        window_id: str,
        sio: socketio.AsyncServer,
        sid: str,
        get_autopilot: Callable[[SessionState], Optional[Autopilot]],
        get_context_item: Callable[[str, str], Awaitable[Optional[ContextItem]]],
        get_config: Callable[[], Optional[ContinueConfig]],
        reload_config: AsyncFunc,
        open_config: Callable[[], Awaitable[None]],
    ):
        self.window_id = window_id
        self.messenger = SocketIOMessenger(sio, sid)
        self.get_autopilot = get_autopilot
        self.get_context_item = get_context_item
        self.get_config = get_config
        self.reload_config = reload_config
        self.open_config = open_config

    async def handle_json(self, msg: WebsocketsMessage):
        data = msg.data
        if msg.message_type == "run_from_state":
            await self.run_from_state(SessionState.parse_obj(data["state"]))
        elif msg.message_type == "stop_session":
            await self.stop_session()
        elif msg.message_type == "get_context_item":
            if ctx_item := await self.get_context_item(data["id"], data["query"]):
                return ctx_item.dict()
            return None
        elif msg.message_type == "get_session_title":
            return await self.get_session_title(
                [StepDescription(**step) for step in data["history"]]
            )
        elif msg.message_type == "get_config":
            if config := self.get_config():
                return config.dict()
            else:
                return None

        elif msg.message_type == "set_system_message":
            sys_message = data["system_message"]
            SerializedContinueConfig.set_system_message(sys_message)
            posthog_logger.capture_event(
                "set_system_message", {"system_message": sys_message}
            )
            await self.reload_config()
            await self.send_config_update()
        elif msg.message_type == "set_temperature":
            SerializedContinueConfig.set_temperature(float(data["temperature"]))
            await self.reload_config()
            await self.send_config_update()
        elif msg.message_type == "add_model_for_role":
            await self.add_model_for_role(
                data["role"], ModelDescription(**data["model"])
            )
            await self.open_config()
        elif msg.message_type == "set_model_for_role_from_title":
            await self.set_model_for_role_from_title(data["role"], data["title"])
        elif msg.message_type == "delete_model_at_index":
            await self.delete_model_at_index(data["index"])

    async def set_model_for_role_from_title(self, role: str, title: str):
        SerializedContinueConfig.set_model_for_role(title, role)
        await self.reload_config()
        await self.send_config_update()

    async def delete_model_at_index(self, index: int):
        if config := self.get_config():
            models = config.models
            if title := models[index].title:
                SerializedContinueConfig.delete_model(title)
                await self.reload_config()
                await self.send_config_update()

    async def add_model_for_role(self, role: str, model: ModelDescription):
        SerializedContinueConfig.add_model(model)
        SerializedContinueConfig.set_model_for_role(model.title, role)
        await self.reload_config()
        await self.send_config_update()

    _running_autopilots: Dict[str, Autopilot] = {}

    async def run_from_state(self, state: SessionState, step: Optional[Step] = None):
        if autopilot := self.get_autopilot(state):
            if step is not None or len(state.history) > 0:
                step_to_log = step or state.history[-1]
                posthog_logger.capture_event(
                    "step run",
                    {
                        "step_name": step_to_log.name,
                        "params": step.dict()
                        if step is not None
                        else state.history[-1].params,
                        "context": list(
                            map(
                                lambda item: item.dict(),
                                state.context_items,
                            )
                        ),
                    },
                )
            cancel_token = str(uuid.uuid4())
            self._running_autopilots[cancel_token] = autopilot
            await autopilot.run(step=step)
            del self._running_autopilots[cancel_token]

        else:
            await self.send_session_update(
                SessionUpdate(stop=True, update=DeltaStep(), index=0)
            )

    async def stop_session(self):
        for autopilot in self._running_autopilots.values():
            autopilot.stopped = True

    async def send_session_update(self, session_update: SessionUpdate):
        await self.messenger.send("session_update", session_update.dict())

    async def send_indexing_progress(self, progress: float):
        await self.messenger.send("indexing_progress", {"progress": progress})

    async def get_session_state(self) -> SessionState:
        return await self.messenger.send_and_receive(
            {}, SessionState, "get_session_state"
        )

    async def add_context_item(self, item: ContextItem):
        await self.messenger.send("add_context_item", item.dict())

    async def send_config_update(self):
        if config := self.get_config():
            await self.messenger.send("config_update", config.dict())

    async def get_session_title(self, history: List[StepDescription]) -> str:
        if autopilot := self.get_autopilot(
            SessionState(history=history, context_items=[])
        ):
            return await autopilot.get_session_title()
        else:
            return "New Session"
