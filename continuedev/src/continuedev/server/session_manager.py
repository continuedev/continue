from fastapi import WebSocket
from typing import Any, Dict, List, Union
from uuid import uuid4

from ..models.filesystem_edit import FileEditWithFullContents
from ..core.policy import DemoPolicy
from ..core.main import FullState
from ..core.autopilot import Autopilot
from .ide_protocol import AbstractIdeProtocolServer
import asyncio
import nest_asyncio
nest_asyncio.apply()


class Session:
    session_id: str
    autopilot: Autopilot
    ws: Union[WebSocket, None]

    def __init__(self, session_id: str, autopilot: Autopilot):
        self.session_id = session_id
        self.autopilot = autopilot
        self.ws = None


class DemoAutopilot(Autopilot):
    first_seen: bool = False
    cumulative_edit_string = ""

    def handle_manual_edits(self, edits: List[FileEditWithFullContents]):
        return
        for edit in edits:
            self.cumulative_edit_string += edit.fileEdit.replacement
            self._manual_edits_buffer.append(edit)
            # Note that you're storing a lot of unecessary data here. Can compress into EditDiffs on the spot, and merge.
            # self._manual_edits_buffer = merge_file_edit(self._manual_edits_buffer, edit)


class SessionManager:
    sessions: Dict[str, Session] = {}
    _event_loop: Union[asyncio.BaseEventLoop, None] = None

    def get_session(self, session_id: str) -> Session:
        if session_id not in self.sessions:
            raise KeyError("Session ID not recognized")
        return self.sessions[session_id]

    def new_session(self, ide: AbstractIdeProtocolServer) -> str:
        autopilot = DemoAutopilot(policy=DemoPolicy(), ide=ide)
        session_id = str(uuid4())
        session = Session(session_id=session_id, autopilot=autopilot)
        self.sessions[session_id] = session

        async def on_update(state: FullState):
            await session_manager.send_ws_data(session_id, "state_update", {
                "state": autopilot.get_full_state().dict()
            })

        autopilot.on_update(on_update)
        asyncio.create_task(autopilot.run_policy())
        return session_id

    def remove_session(self, session_id: str):
        del self.sessions[session_id]

    def register_websocket(self, session_id: str, ws: WebSocket):
        self.sessions[session_id].ws = ws
        print("Registered websocket for session", session_id)

    async def send_ws_data(self, session_id: str, message_type: str, data: Any):
        if self.sessions[session_id].ws is None:
            print(f"Session {session_id} has no websocket")
            return

        await self.sessions[session_id].ws.send_json({
            "messageType": message_type,
            "data": data
        })


session_manager = SessionManager()
