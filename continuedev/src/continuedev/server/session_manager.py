from fastapi import WebSocket
from typing import Any, Dict, List, Union
from uuid import uuid4

from ..models.filesystem_edit import FileEditWithFullContents
from ..core.policy import DemoPolicy
from ..core.main import FullState
from ..core.agent import Agent
from ..libs.steps.nate import ImplementAbstractMethodStep
from .ide_protocol import AbstractIdeProtocolServer
import asyncio
import nest_asyncio
nest_asyncio.apply()


class Session:
    session_id: str
    agent: Agent
    ws: Union[WebSocket, None]

    def __init__(self, session_id: str, agent: Agent):
        self.session_id = session_id
        self.agent = agent
        self.ws = None


class DemoAgent(Agent):
    first_seen: bool = False
    cumulative_edit_string = ""

    def handle_manual_edits(self, edits: List[FileEditWithFullContents]):
        for edit in edits:
            self.cumulative_edit_string += edit.fileEdit.replacement
            self._manual_edits_buffer.append(edit)
            # Note that you're storing a lot of unecessary data here. Can compress into EditDiffs on the spot, and merge.
            # self._manual_edits_buffer = merge_file_edit(self._manual_edits_buffer, edit)
            # FOR DEMO PURPOSES
            if edit.fileEdit.filepath.endswith("filesystem.py") and "List" in self.cumulative_edit_string and ":" in edit.fileEdit.replacement:
                self.cumulative_edit_string = ""
                asyncio.create_task(self.run_from_step(
                    ImplementAbstractMethodStep()))


class SessionManager:
    sessions: Dict[str, Session] = {}
    _event_loop: Union[asyncio.BaseEventLoop, None] = None

    def get_session(self, session_id: str) -> Session:
        if session_id not in self.sessions:
            raise KeyError("Session ID not recognized")
        return self.sessions[session_id]

    def new_session(self, ide: AbstractIdeProtocolServer) -> str:
        agent = DemoAgent(policy=DemoPolicy(), ide=ide)
        session_id = str(uuid4())
        session = Session(session_id=session_id, agent=agent)
        self.sessions[session_id] = session

        async def on_update(state: FullState):
            await session_manager.send_ws_data(session_id, "state_update", {
                "state": agent.get_full_state().dict()
            })

        agent.on_update(on_update)
        asyncio.create_task(agent.run_policy())
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

        async def a():
            await self.sessions[session_id].ws.send_json({
                "messageType": message_type,
                "data": data
            })

        # Run coroutine in background
        await self.sessions[session_id].ws.send_json({
            "messageType": message_type,
            "data": data
        })
        return
        if self._event_loop is None or self._event_loop.is_closed():
            self._event_loop = asyncio.new_event_loop()
            self._event_loop.run_until_complete(a())
            self._event_loop.close()
        else:
            self._event_loop.run_until_complete(a())
            self._event_loop.close()


session_manager = SessionManager()
