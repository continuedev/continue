import os
from fastapi import WebSocket
from typing import Any, Dict, List, Union
from uuid import uuid4
import json

from ..libs.util.paths import getSessionFilePath, getSessionsFolderPath
from ..models.filesystem_edit import FileEditWithFullContents
from ..libs.constants.main import CONTINUE_SESSIONS_FOLDER
from ..core.policy import DemoPolicy
from ..core.main import FullState
from ..core.autopilot import Autopilot
from .ide_protocol import AbstractIdeProtocolServer
from ..libs.util.create_async_task import create_async_task
from ..libs.util.errors import SessionNotFound


class Session:
    session_id: str
    autopilot: Autopilot
    # The GUI websocket for the session
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
    # Mapping of session_id to IDE, where the IDE is still alive
    registered_ides: Dict[str, AbstractIdeProtocolServer] = {}

    async def get_session(self, session_id: str) -> Session:
        if session_id not in self.sessions:
            # Check then whether it is persisted by listing all files in the sessions folder
            # And only if the IDE is still alive
            sessions_folder = getSessionsFolderPath()
            session_files = os.listdir(sessions_folder)
            if f"{session_id}.json" in session_files and session_id in self.registered_ides:
                if self.registered_ides[session_id].session_id is not None:
                    return await self.new_session(self.registered_ides[session_id], session_id=session_id)

            raise KeyError("Session ID not recognized", session_id)
        return self.sessions[session_id]

    async def new_session(self, ide: AbstractIdeProtocolServer, session_id: Union[str, None] = None) -> Session:
        full_state = None
        if session_id is not None and os.path.exists(getSessionFilePath(session_id)):
            with open(getSessionFilePath(session_id), "r") as f:
                full_state = FullState(**json.load(f))

        autopilot = await DemoAutopilot.create(
            policy=DemoPolicy(), ide=ide, full_state=full_state)
        session_id = session_id or str(uuid4())
        ide.session_id = session_id
        session = Session(session_id=session_id, autopilot=autopilot)
        self.sessions[session_id] = session
        self.registered_ides[session_id] = ide

        async def on_update(state: FullState):
            await session_manager.send_ws_data(session_id, "state_update", {
                "state": state.dict()
            })

        autopilot.on_update(on_update)
        create_async_task(autopilot.run_policy())
        return session

    def remove_session(self, session_id: str):
        del self.sessions[session_id]

    async def persist_session(self, session_id: str):
        """Save the session's FullState as a json file"""
        full_state = await self.sessions[session_id].autopilot.get_full_state()
        if not os.path.exists(getSessionsFolderPath()):
            os.mkdir(getSessionsFolderPath())
        with open(getSessionFilePath(session_id), "w") as f:
            json.dump(full_state.dict(), f)

    def register_websocket(self, session_id: str, ws: WebSocket):
        self.sessions[session_id].ws = ws
        print("Registered websocket for session", session_id)

    async def send_ws_data(self, session_id: str, message_type: str, data: Any):
        if session_id not in self.sessions:
            raise SessionNotFound(f"Session {session_id} not found")
        if self.sessions[session_id].ws is None:
            # print(f"Session {session_id} has no websocket")
            return

        await self.sessions[session_id].ws.send_json({
            "messageType": message_type,
            "data": data
        })


session_manager = SessionManager()
