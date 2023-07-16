# This is a separate server from server/main.py
from functools import cached_property
import json
import os
from typing import Any, Dict, List, Type, TypeVar, Union
import uuid
from fastapi import WebSocket, Body, APIRouter
from starlette.websockets import WebSocketState, WebSocketDisconnect
from uvicorn.main import Server
import traceback

from ..libs.util.telemetry import capture_event
from ..libs.util.queue import AsyncSubscriptionQueue
from ..models.filesystem import FileSystem, RangeInFile, EditDiff, RangeInFileWithContents, RealFileSystem
from ..models.filesystem_edit import AddDirectory, AddFile, DeleteDirectory, DeleteFile, FileSystemEdit, FileEdit, FileEditWithFullContents, RenameDirectory, RenameFile, SequentialFileSystemEdit
from pydantic import BaseModel
from .gui import SessionManager, session_manager
from .ide_protocol import AbstractIdeProtocolServer
import asyncio
from ..libs.util.create_async_task import create_async_task
import nest_asyncio
nest_asyncio.apply()


router = APIRouter(prefix="/ide", tags=["ide"])


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


# TYPES #


class FileEditsUpdate(BaseModel):
    fileEdits: List[FileEditWithFullContents]


class OpenFilesResponse(BaseModel):
    openFiles: List[str]


class VisibleFilesResponse(BaseModel):
    visibleFiles: List[str]


class HighlightedCodeResponse(BaseModel):
    highlightedCode: List[RangeInFile]


class ShowSuggestionRequest(BaseModel):
    suggestion: FileEdit


class ShowSuggestionResponse(BaseModel):
    suggestion: FileEdit
    accepted: bool


class ReadFileResponse(BaseModel):
    contents: str


class EditFileResponse(BaseModel):
    fileEdit: FileEditWithFullContents


class WorkspaceDirectoryResponse(BaseModel):
    workspaceDirectory: str


class GetUserSecretResponse(BaseModel):
    value: str


class RunCommandResponse(BaseModel):
    output: str = ""


class UniqueIdResponse(BaseModel):
    uniqueId: str


T = TypeVar("T", bound=BaseModel)


class cached_property_no_none:
    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner):
        if instance is None:
            return self
        value = self.func(instance)
        if value is not None:
            setattr(instance, self.func.__name__, value)
        return value

    def __repr__(self):
        return f"<cached_property_no_none '{self.func.__name__}'>"


class IdeProtocolServer(AbstractIdeProtocolServer):
    websocket: WebSocket
    session_manager: SessionManager
    sub_queue: AsyncSubscriptionQueue = AsyncSubscriptionQueue()
    session_id: Union[str, None] = None

    def __init__(self, session_manager: SessionManager, websocket: WebSocket):
        self.websocket = websocket
        self.session_manager = session_manager

    workspace_directory: str = None
    unique_id: str = None

    async def initialize(self, session_id: str) -> List[str]:
        self.session_id = session_id
        await self._send_json("workspaceDirectory", {})
        await self._send_json("uniqueId", {})
        other_msgs = []
        while True:
            msg_string = await self.websocket.receive_text()
            message = json.loads(msg_string)
            if "messageType" not in message or "data" not in message:
                continue
            message_type = message["messageType"]
            data = message["data"]
            if message_type == "workspaceDirectory":
                self.workspace_directory = data["workspaceDirectory"]
            elif message_type == "uniqueId":
                self.unique_id = data["uniqueId"]
            else:
                other_msgs.append(msg_string)

            if self.workspace_directory is not None and self.unique_id is not None:
                break
        return other_msgs

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
                "IDE Protocol _receive_json timed out after 5 seconds")

    async def _send_and_receive_json(self, data: Any, resp_model: Type[T], message_type: str) -> T:
        await self._send_json(message_type, data)
        resp = await self._receive_json(message_type)
        return resp_model.parse_obj(resp)

    async def handle_json(self, message_type: str, data: Any):
        if message_type == "getSessionId":
            await self.getSessionId()
        elif message_type == "setFileOpen":
            await self.setFileOpen(data["filepath"], data["open"])
        elif message_type == "setSuggestionsLocked":
            await self.setSuggestionsLocked(data["filepath"], data["locked"])
        elif message_type == "fileEdits":
            fileEdits = list(
                map(lambda d: FileEditWithFullContents.parse_obj(d), data["fileEdits"]))
            self.onFileEdits(fileEdits)
        elif message_type == "highlightedCodePush":
            self.onHighlightedCodeUpdate(
                [RangeInFileWithContents(**rif) for rif in data["highlightedCode"]])
        elif message_type == "commandOutput":
            output = data["output"]
            self.onCommandOutput(output)
        elif message_type == "acceptRejectSuggestion":
            self.onAcceptRejectSuggestion(data["accepted"])
        elif message_type == "acceptRejectDiff":
            self.onAcceptRejectDiff(data["accepted"])
        elif message_type == "mainUserInput":
            self.onMainUserInput(data["input"])
        elif message_type == "deleteAtIndex":
            self.onDeleteAtIndex(data["index"])
        elif message_type in ["highlightedCode", "openFiles", "visibleFiles", "readFile", "editFile", "getUserSecret", "runCommand"]:
            self.sub_queue.post(message_type, data)
        elif message_type == "workspaceDirectory":
            self.workspace_directory = data["workspaceDirectory"]
        elif message_type == "uniqueId":
            self.unique_id = data["uniqueId"]
        else:
            raise ValueError("Unknown message type", message_type)

    # ------------------------------- #
    # Request actions in IDE, doesn't matter which Session
    async def showSuggestion(self, file_edit: FileEdit):
        await self._send_json("showSuggestion", {
            "edit": file_edit.dict()
        })

    async def showDiff(self, filepath: str, replacement: str, step_index: int):
        await self._send_json("showDiff", {
            "filepath": filepath,
            "replacement": replacement,
            "step_index": step_index
        })

    async def setFileOpen(self, filepath: str, open: bool = True):
        # Autopilot needs access to this.
        await self._send_json("setFileOpen", {
            "filepath": filepath,
            "open": open
        })

    async def setSuggestionsLocked(self, filepath: str, locked: bool = True):
        # Lock suggestions in the file so they don't ruin the offset before others are inserted
        await self._send_json("setSuggestionsLocked", {
            "filepath": filepath,
            "locked": locked
        })

    async def getSessionId(self):
        session_id = (await self.session_manager.new_session(
            self, self.session_id)).session_id
        await self._send_json("getSessionId", {
            "sessionId": session_id
        })

    async def highlightCode(self, range_in_file: RangeInFile, color: str = "#00ff0022"):
        await self._send_json("highlightCode", {
            "rangeInFile": range_in_file.dict(),
            "color": color
        })

    async def runCommand(self, command: str) -> str:
        return (await self._send_and_receive_json({"command": command}, RunCommandResponse, "runCommand")).output

    async def showSuggestionsAndWait(self, suggestions: List[FileEdit]) -> bool:
        ids = [str(uuid.uuid4()) for _ in suggestions]
        for i in range(len(suggestions)):
            self._send_json("showSuggestion", {
                "suggestion": suggestions[i],
                "suggestionId": ids[i]
            })
        responses = await asyncio.gather(*[
            self._receive_json(ShowSuggestionResponse)
            for i in range(len(suggestions))
        ])  # WORKING ON THIS FLOW HERE. Fine now to just await for response, instead of doing something fancy with a "waiting" state on the autopilot.
        # Just need connect the suggestionId to the IDE (and the gui)
        return any([r.accepted for r in responses])

    # ------------------------------- #
    # Here needs to pass message onto the Autopilot OR Autopilot just subscribes.
    # This is where you might have triggers: plugins can subscribe to certian events
    # like file changes, tracebacks, etc...

    def onAcceptRejectSuggestion(self, accepted: bool):
        capture_event(self.unique_id, "accept_reject_suggestion", {
            "accepted": accepted
        })

    def onAcceptRejectDiff(self, accepted: bool):
        capture_event(self.unique_id, "accept_reject_diff", {
            "accepted": accepted
        })

    def onFileSystemUpdate(self, update: FileSystemEdit):
        # Access to Autopilot (so SessionManager)
        pass

    def onCloseGUI(self, session_id: str):
        # Accesss to SessionManager
        pass

    def onOpenGUIRequest(self):
        pass

    def __get_autopilot(self):
        return self.session_manager.sessions[self.session_id].autopilot

    def onFileEdits(self, edits: List[FileEditWithFullContents]):
        if autopilot := self.__get_autopilot():
            autopilot.handle_manual_edits(edits)

    def onDeleteAtIndex(self, index: int):
        if autopilot := self.__get_autopilot():
            create_async_task(autopilot.delete_at_index(index), self.unique_id)

    def onCommandOutput(self, output: str):
        if autopilot := self.__get_autopilot():
            create_async_task(
                autopilot.handle_command_output(output), self.unique_id)

    def onHighlightedCodeUpdate(self, range_in_files: List[RangeInFileWithContents]):
        if autopilot := self.__get_autopilot():
            create_async_task(autopilot.handle_highlighted_code(
                range_in_files), self.unique_id)

    def onMainUserInput(self, input: str):
        if autopilot := self.__get_autopilot():
            create_async_task(
                autopilot.accept_user_input(input), self.unique_id)

    # Request information. Session doesn't matter.
    async def getOpenFiles(self) -> List[str]:
        resp = await self._send_and_receive_json({}, OpenFilesResponse, "openFiles")
        return resp.openFiles

    async def getVisibleFiles(self) -> List[str]:
        resp = await self._send_and_receive_json({}, VisibleFilesResponse, "visibleFiles")
        return resp.visibleFiles

    async def getHighlightedCode(self) -> List[RangeInFile]:
        resp = await self._send_and_receive_json({}, HighlightedCodeResponse, "highlightedCode")
        return resp.highlightedCode

    async def readFile(self, filepath: str) -> str:
        """Read a file"""
        resp = await self._send_and_receive_json({
            "filepath": filepath
        }, ReadFileResponse, "readFile")
        return resp.contents

    async def getUserSecret(self, key: str) -> str:
        """Get a user secret"""
        try:
            resp = await self._send_and_receive_json({
                "key": key
            }, GetUserSecretResponse, "getUserSecret")
            return resp.value
        except Exception as e:
            print("Error getting user secret", e)
            return ""

    async def saveFile(self, filepath: str):
        """Save a file"""
        await self._send_json("saveFile", {
            "filepath": filepath
        })

    async def readRangeInFile(self, range_in_file: RangeInFile) -> str:
        """Read a range in a file"""
        full_contents = await self.readFile(range_in_file.filepath)
        return FileSystem.read_range_in_str(full_contents, range_in_file.range)

    async def editFile(self, edit: FileEdit) -> FileEditWithFullContents:
        """Edit a file"""
        resp = await self._send_and_receive_json({
            "edit": edit.dict()
        }, EditFileResponse, "editFile")
        return resp.fileEdit

    async def applyFileSystemEdit(self, edit: FileSystemEdit) -> EditDiff:
        """Apply a file edit"""
        backward = None
        fs = RealFileSystem()
        if isinstance(edit, FileEdit):
            file_edit = await self.editFile(edit)
            _, diff = FileSystem.apply_edit_to_str(
                file_edit.fileContents, file_edit.fileEdit)
            backward = diff.backward
        elif isinstance(edit, AddFile):
            fs.write(edit.filepath, edit.content)
            backward = DeleteFile(filepath=edit.filepath)
        elif isinstance(edit, DeleteFile):
            contents = await self.readFile(edit.filepath)
            backward = AddFile(filepath=edit.filepath, content=contents)
            fs.delete_file(edit.filepath)
        elif isinstance(edit, RenameFile):
            fs.rename_file(edit.filepath, edit.new_filepath)
            backward = RenameFile(filepath=edit.new_filepath,
                                  new_filepath=edit.filepath)
        elif isinstance(edit, AddDirectory):
            fs.add_directory(edit.path)
            backward = DeleteDirectory(path=edit.path)
        elif isinstance(edit, DeleteDirectory):
            # This isn't atomic!
            backward_edits = []
            for root, dirs, files in os.walk(edit.path, topdown=False):
                for f in files:
                    path = os.path.join(root, f)
                    edit_diff = await self.applyFileSystemEdit(DeleteFile(filepath=path))
                    backward_edits.append(edit_diff)
                for d in dirs:
                    path = os.path.join(root, d)
                    edit_diff = await self.applyFileSystemEdit(DeleteDirectory(path=path))
                    backward_edits.append(edit_diff)

            edit_diff = await self.applyFileSystemEdit(DeleteDirectory(path=edit.path))
            backward_edits.append(edit_diff)
            backward_edits.reverse()
            backward = SequentialFileSystemEdit(edits=backward_edits)
        elif isinstance(edit, RenameDirectory):
            fs.rename_directory(edit.path, edit.new_path)
            backward = RenameDirectory(path=edit.new_path, new_path=edit.path)
        elif isinstance(edit, FileSystemEdit):
            diffs = []
            for edit in edit.next_edit():
                edit_diff = await self.applyFileSystemEdit(edit)
                diffs.append(edit_diff)
            backward = EditDiff.from_sequence(diffs=diffs).backward
        else:
            raise TypeError("Unknown FileSystemEdit type: " + str(type(edit)))

        return EditDiff(
            forward=edit,
            backward=backward
        )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = None):
    try:
        await websocket.accept()
        print("Accepted websocket connection from, ", websocket.client)
        await websocket.send_json({"messageType": "connected", "data": {}})

        def handle_msg(msg):
            message = json.loads(msg)

            if "messageType" not in message or "data" not in message:
                return
            message_type = message["messageType"]
            data = message["data"]

            create_async_task(
                ideProtocolServer.handle_json(message_type, data))

        ideProtocolServer = IdeProtocolServer(session_manager, websocket)
        if session_id is not None:
            session_manager.registered_ides[session_id] = ideProtocolServer
        other_msgs = await ideProtocolServer.initialize(session_id)

        for other_msg in other_msgs:
            handle_msg(other_msg)

        while AppStatus.should_exit is False:
            message = await websocket.receive_text()
            handle_msg(message)

        print("Closing ide websocket")
    except WebSocketDisconnect as e:
        print("IDE wbsocket disconnected")
    except Exception as e:
        print("Error in ide websocket: ", e)
        capture_event(ideProtocolServer.unique_id, "gui_error", {
                      "error_title": e.__str__() or e.__repr__(), "error_message": '\n'.join(traceback.format_exception(e))})
        raise e
    finally:
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()

        session_manager.registered_ides.pop(ideProtocolServer.session_id)
