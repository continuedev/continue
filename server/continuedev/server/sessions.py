import json
import os
import time
from typing import List
import uuid

from pydantic import BaseModel
from ..core.main import SessionInfo, SessionState, StepDescription

from fastapi import APIRouter

from ..libs.util.paths import (
    getSessionFilePath,
    getSessionsListFilePath,
)
from ..libs.util.logging import logger

router = APIRouter(prefix="/sessions", tags=["sessions"])


class PersistedSessionInfo(BaseModel):
    session_state: SessionState
    title: str
    workspace_directory: str
    session_id: str


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


class DeleteSessionBody(BaseModel):
    session_id: str


@router.post("/delete")
async def delete_session(body: DeleteSessionBody):
    """Delete a session"""
    session_file = getSessionFilePath(body.session_id)
    if not os.path.exists(session_file):
        raise Exception(f"Session file {session_file} does not exist")
    os.remove(session_file)

    # Read and update the sessions list
    with open(getSessionsListFilePath(), "r") as f:
        try:
            sessions_list: List[SessionInfo] = json.load(f)
        except json.JSONDecodeError:
            raise Exception(
                f"It looks like there is a JSON formatting error in your sessions.json file ({getSessionsListFilePath()}). Please fix this before creating a new session."
            )

    sessions_list = [
        session for session in sessions_list if session["session_id"] != body.session_id
    ]

    with open(getSessionsListFilePath(), "w") as f:
        json.dump(sessions_list, f)

    return


@router.get("/{session_id}")
async def load_session(session_id: str) -> PersistedSessionInfo:
    """Load a session"""
    session_file = getSessionFilePath(session_id)
    if not os.path.exists(session_file):
        raise Exception(f"Session file {session_file} does not exist")
    session_state = json.load(open(session_file, "r"))
    try:
        if "active" in session_state:
            # Indicator of old version. Try to migrate
            def migrate_node(node):
                step = node["step"]
                return StepDescription(
                    step_type=step["class_name"],
                    name=step["name"],
                    description=step["description"],
                    params={},
                    hide=step["hide"],
                    depth=node["depth"],
                    observations=[],
                    logs=node["logs"] if "logs" in node else [],
                )

            migrated_state = SessionState(
                context_items=session_state["selected_context_items"],
                history=list(map(migrate_node, session_state["history"]["timeline"])),
            )
            return PersistedSessionInfo(
                session_state=migrated_state,
                title=session_state["session_info"]["title"],
                workspace_directory=session_state["session_info"][
                    "workspace_directory"
                ],
                session_id=session_id,
            )

        else:
            kwargs = session_state
            kwargs.update({"session_id": session_id})
            return PersistedSessionInfo(**kwargs)
    except Exception as e:
        logger.warning(f"Error migrating session: {e}")
        return PersistedSessionInfo(
            session_state=SessionState(history=[], context_items=[]),
            title="Old Session Format",
            workspace_directory="",
            session_id=session_id,
        )


@router.post("/save")
async def save_session(body: PersistedSessionInfo):
    # Save the main session json file
    with open(getSessionFilePath(body.session_id), "w") as f:
        json.dump(body.dict(), f)

    # Read and update the sessions list
    with open(getSessionsListFilePath(), "r") as f:
        try:
            sessions_list: List[SessionInfo] = json.load(f)
        except json.JSONDecodeError:
            raise Exception(
                f"It looks like there is a JSON formatting error in your sessions.json file ({getSessionsListFilePath()}). Please fix this before creating a new session."
            )

    found = False
    for session_info in sessions_list:
        if session_info["session_id"] == body.session_id:
            session_info["title"] = body.title
            session_info["workspace_directory"] = body.workspace_directory
            session_info["date_created"] = str(time.time())
            found = True
            break

    if not found:
        session_info = SessionInfo(
            session_id=body.session_id,
            title=body.title,
            date_created=str(time.time()),
            workspace_directory=body.workspace_directory,
        )
        sessions_list.append(session_info.dict())

    for session_info in sessions_list:
        # A migration
        if "workspace_directory" not in session_info:
            session_info["workspace_directory"] = ""

    with open(getSessionsListFilePath(), "w") as f:
        json.dump(sessions_list, f)
