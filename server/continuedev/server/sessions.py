import json
import os
import time
from typing import List
import uuid

from pydantic import BaseModel
from ..core.main import SessionInfo, SessionState

from fastapi import APIRouter

from ..libs.util.paths import (
    getSessionFilePath,
    getSessionsListFilePath,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


class PersistedSessionInfo(BaseModel):
    session_state: SessionState
    title: str
    workspace_directory: str


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


@router.get("/{session_id}")
async def load_session(session_id: str) -> PersistedSessionInfo:
    """Load a session"""
    session_file = getSessionFilePath(session_id)
    if not os.path.exists(session_file):
        raise Exception(f"Session file {session_file} does not exist")
    session_state = json.load(open(session_file, "r"))
    try:
        # TODO: Migrate
        session_state = PersistedSessionInfo(**session_state)
    except Exception:
        return PersistedSessionInfo(
            session_state=SessionState(history=[], context_items=[]),
            title="Old Session Format",
            workspace_directory="",
        )
    return session_state


@router.post("/save")
async def save_session(body: PersistedSessionInfo):
    session_id = uuid.uuid4().hex
    with open(getSessionFilePath(session_id), "w") as f:
        json.dump(body.dict(), f)

    # Read and update the sessions list
    with open(getSessionsListFilePath(), "r") as f:
        try:
            sessions_list: List[SessionInfo] = json.load(f)
        except json.JSONDecodeError:
            raise Exception(
                f"It looks like there is a JSON formatting error in your sessions.json file ({getSessionsListFilePath()}). Please fix this before creating a new session."
            )

    session_ids = [s["session_id"] for s in sessions_list]
    if session_id not in session_ids:
        session_info = SessionInfo(
            session_id=session_id,
            title=body.title,
            date_created=str(time.time()),
            workspace_directory=body.workspace_directory,
        )
        sessions_list.append(session_info.dict())

    for session_info in sessions_list:
        if "workspace_directory" not in session_info:
            session_info["workspace_directory"] = ""

    with open(getSessionsListFilePath(), "w") as f:
        json.dump(sessions_list, f)
