import json
import os
import traceback
from typing import Any, Coroutine, Dict, Optional, Union
from uuid import uuid4

from fastapi import APIRouter, WebSocket
from fastapi.websockets import WebSocketState

from ..core.autopilot import Autopilot
from ..core.config import ContinueConfig
from ..core.main import FullState
from ..libs.util.create_async_task import create_async_task
from ..libs.util.logging import logger
from ..libs.util.paths import (
    getSessionFilePath,
    getSessionsFolderPath,
    getSessionsListFilePath,
)
from .ide_protocol import AbstractIdeProtocolServer

router = APIRouter(prefix="/sessions", tags=["sessions"])


class Session:
    session_id: str
    autopilot: Autopilot
    # The GUI websocket for the session
    ws: Union[WebSocket, None]

    def __init__(self, session_id: str, autopilot: Autopilot):
        self.session_id = session_id
        self.autopilot = autopilot
        self.ws = None


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
            if (
                f"{session_id}.json" in session_files
                and session_id in self.registered_ides
            ):
                if self.registered_ides[session_id].session_id is not None:
                    return await self.new_session(
                        self.registered_ides[session_id], session_id=session_id
                    )

            raise KeyError("Session ID not recognized", session_id)
        return self.sessions[session_id]

    async def new_session(
        self,
        ide: AbstractIdeProtocolServer,
        session_id: Optional[str] = None,
        config: Optional[ContinueConfig] = None,
    ) -> Session:
        logger.debug(f"New session: {session_id}")

        # Load the persisted state (not being used right now)
        full_state = None
        if session_id is not None and os.path.exists(getSessionFilePath(session_id)):
            with open(getSessionFilePath(session_id), "r") as f:
                full_state = FullState(**json.load(f))

        # Register the session and ide (do this first so that the autopilot can access the session)
        autopilot = Autopilot(ide=ide)
        session_id = session_id or str(uuid4())
        ide.session_id = session_id
        session = Session(session_id=session_id, autopilot=autopilot)
        self.sessions[session_id] = session
        self.registered_ides[session_id] = ide

        # Set up the autopilot to update the GUI
        async def on_update(state: FullState):
            await session_manager.send_ws_data(
                session_id, "state_update", {"state": state.dict()}
            )

        autopilot.on_update(on_update)

        # Start the autopilot (must be after session is added to sessions) and the policy
        try:
            await autopilot.start(full_state=full_state, config=config)
        except Exception as e:
            await ide.on_error(e)

        def on_error(e: Exception) -> Coroutine:
            err_msg = "\n".join(traceback.format_exception(e))
            return ide.showMessage(f"Error in Continue server: {err_msg}")

        create_async_task(autopilot.run_policy(), on_error)
        return session

    async def remove_session(self, session_id: str):
        logger.debug(f"Removing session: {session_id}")
        if session_id in self.sessions:
            if (
                session_id in self.registered_ides
                and self.registered_ides[session_id] is not None
            ):
                ws_to_close = self.registered_ides[session_id].websocket
                if (
                    ws_to_close is not None
                    and ws_to_close.client_state != WebSocketState.DISCONNECTED
                ):
                    await self.sessions[session_id].autopilot.ide.websocket.close()

            del self.sessions[session_id]

    async def persist_session(self, session_id: str):
        """Save the session's FullState as a json file"""
        full_state = await self.sessions[session_id].autopilot.get_full_state()
        if full_state.session_info is None:
            return

        with open(getSessionFilePath(session_id), "w") as f:
            json.dump(full_state.dict(), f)

        # Read and update the sessions list
        with open(getSessionsListFilePath(), "r") as f:
            try:
                sessions_list = json.load(f)
            except json.JSONDecodeError:
                raise Exception(
                    f"It looks like there is a JSON formatting error in your sessions.json file ({getSessionsListFilePath()}). Please fix this before creating a new session."
                )

        session_ids = [s["session_id"] for s in sessions_list]
        if session_id not in session_ids:
            sessions_list.append(full_state.session_info.dict())

        for session_info in sessions_list:
            if "workspace_directory" not in session_info:
                session_info["workspace_directory"] = ""

        with open(getSessionsListFilePath(), "w") as f:
            json.dump(sessions_list, f)

    async def load_session(
        self, old_session_id: str, new_session_id: Optional[str] = None
    ) -> str:
        """Load the session's FullState from a json file"""

        # First persist the current state
        await self.persist_session(old_session_id)

        # Delete the old session, but keep the IDE
        ide = self.registered_ides[old_session_id]
        del self.registered_ides[old_session_id]

        # Start the new session
        new_session = await self.new_session(ide, session_id=new_session_id)
        return new_session.session_id

    def register_websocket(self, session_id: str, ws: WebSocket):
        self.sessions[session_id].ws = ws
        logger.debug(f"Registered websocket for session {session_id}")

    async def send_ws_data(self, session_id: str, message_type: str, data: Any):
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found")
            return
        if self.sessions[session_id].ws is None:
            return

        await self.sessions[session_id].ws.send_json(
            {"messageType": message_type, "data": data}
        )


session_manager = SessionManager()


@router.get("/list")
async def list_sessions():
    """List all sessions"""
    sessions_list_file = getSessionsListFilePath()
    if not os.path.exists(sessions_list_file):
        print("Returning empty sessions list")
        return []
    sessions = json.load(open(sessions_list_file, "r"))
    print("Returning sessions list: ", sessions)
    return sessions
