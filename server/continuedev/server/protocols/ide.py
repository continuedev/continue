# This is a separate server from server/main.py
import asyncio
import os
from typing import Any, Callable, Coroutine, Dict, List, Optional

import socketio
from pydantic import BaseModel

from ...libs.util.create_async_task import create_async_task
from ...libs.util.devdata import dev_data_logger
from ...libs.util.errors import format_exc
from ...libs.util.logging import logger
from ...libs.util.telemetry import posthog_logger
from ...models.filesystem import (
    FileSystem,
    RangeInFile,
    RangeInFileWithContents,
    RealFileSystem,
)
from ...models.filesystem_edit import (
    AddDirectory,
    AddFile,
    DeleteDirectory,
    DeleteFile,
    EditDiff,
    FileEdit,
    FileEditWithFullContents,
    FileSystemEdit,
    RenameDirectory,
    RenameFile,
    SequentialFileSystemEdit,
)
from ...models.main import Position, Range
from ...models.websockets import WebsocketsMessage
from ..websockets_messenger import SocketIOMessenger
from .ide_protocol import AbstractIdeProtocolServer, WindowInfo

# region: Types


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


class TerminalContentsResponse(BaseModel):
    contents: str


class ListDirectoryContentsResponse(BaseModel):
    contents: List[str]


class FileExistsResponse(BaseModel):
    exists: bool


class GotoDefinitionResponse(BaseModel):
    locations: List[Dict[str, Any]]


class ReferencesResponse(BaseModel):
    locations: List[Dict[str, Any]]


class DocumentSymbolResponse(BaseModel):
    symbols: List[Dict[str, Any]]


class FoldingRangeResponse(BaseModel):
    ranges: List[Dict[str, Any]]


# endregion


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
    messenger: SocketIOMessenger
    window_info: WindowInfo

    @property
    def workspace_directory(self) -> str:
        return self.window_info.workspace_directory

    def __init__(self, window_info: WindowInfo, sio: socketio.AsyncServer, sid: str):
        self.messenger = SocketIOMessenger(sio, sid)
        self.window_info = window_info

    async def handle_json(self, msg: WebsocketsMessage):
        data = msg.data
        if msg.message_type == "setFileOpen":
            await self.setFileOpen(data["filepath"], data["open"])
        elif msg.message_type == "setSuggestionsLocked":
            await self.setSuggestionsLocked(data["filepath"], data["locked"])
        elif msg.message_type == "fileEdits":
            fileEdits = list(
                map(lambda d: FileEditWithFullContents.parse_obj(d), data["fileEdits"])
            )
            self.onFileEdits(fileEdits)
        elif msg.message_type == "highlightedCodePush":
            self.onHighlightedCodeUpdate(
                [RangeInFileWithContents(**rif) for rif in data["highlightedCode"]],
                edit=data.get("edit", False),
            )
        elif msg.message_type == "debugTerminal":
            content = data["contents"]
            self.onDebugTerminal(content)
        elif msg.message_type == "acceptRejectSuggestion":
            self.onAcceptRejectSuggestion(data["accepted"])
        elif msg.message_type == "acceptRejectDiff":
            self.onAcceptRejectDiff(data["accepted"], data["stepIndex"])
        elif msg.message_type in [
            "highlightedCode",
            "openFiles",
            "visibleFiles",
            "readFile",
            "editFile",
            "getUserSecret",
            "runCommand",
            "getTerminalContents",
            "listDirectoryContents",
            "fileExists",
        ]:
            # self.messenger.post(msg)
            pass
        elif msg.message_type == "workspaceDirectory":
            self.window_info.workspace_directory = data["workspaceDirectory"]
        elif msg.message_type == "uniqueId":
            self.unique_id = data["uniqueId"]
        elif msg.message_type == "ide":
            self.ide_info = data
        elif msg.message_type == "filesCreated":
            self.onFilesCreated(data["filepaths"])
        elif msg.message_type == "filesDeleted":
            self.onFilesDeleted(data["filepaths"])
        elif msg.message_type == "filesRenamed":
            self.onFilesRenamed(data["old_filepaths"], data["new_filepaths"])
        elif msg.message_type == "fileSaved":
            self.onFileSaved(data["filepath"], data["contents"])
        elif msg.message_type == "setTelemetryEnabled":
            self.onTelemetryEnabledChanged(data["enabled"])
        else:
            raise ValueError("Unknown message type", msg.message_type)

    async def showSuggestion(self, file_edit: FileEdit):
        await self.messenger.send("showSuggestion", {"edit": file_edit.dict()})

    async def showDiff(self, filepath: str, replacement: str, step_index: int):
        await self.messenger.send(
            "showDiff",
            {
                "filepath": filepath,
                "replacement": replacement,
                "step_index": step_index,
            },
        )

    async def showMultiFileEdit(self, edits: List[FileEdit]):
        await self.messenger.send(
            "showMultiFileEdit", {"edits": [edit.dict() for edit in edits]}
        )

    async def setFileOpen(self, filepath: str, open: bool = True):
        # Autopilot needs access to this.
        await self.messenger.send("setFileOpen", {"filepath": filepath, "open": open})

    async def showMessage(self, message: str):
        await self.messenger.send("showMessage", {"message": message})

    async def showVirtualFile(self, name: str, contents: str):
        await self.messenger.send(
            "showVirtualFile", {"name": name, "contents": contents}
        )

    async def setSuggestionsLocked(self, filepath: str, locked: bool = True):
        # Lock suggestions in the file so they don't ruin the offset before others are inserted
        await self.messenger.send(
            "setSuggestionsLocked", {"filepath": filepath, "locked": locked}
        )

    async def highlightCode(self, range_in_file: RangeInFile, color: str = "#00ff0022"):
        await self.messenger.send(
            "highlightCode", {"rangeInFile": range_in_file.dict(), "color": color}
        )

    async def runCommand(self, command: str) -> str:
        return (
            await self.messenger.send_and_receive(
                {"command": command}, RunCommandResponse, "runCommand"
            )
        ).output

    def on_error(self, e: Exception) -> Coroutine:
        err_msg = format_exc(e)
        e_title = e.__str__() or e.__repr__()
        return self.showMessage(f"Error in Continue server: {e_title}\n {err_msg}")

    def onAcceptRejectSuggestion(self, accepted: bool):
        posthog_logger.capture_event("accept_reject_suggestion", {"accepted": accepted})
        dev_data_logger.capture("accept_reject_suggestion", {"accepted": accepted})

    def onAcceptRejectDiff(self, accepted: bool, step_index: int):
        posthog_logger.capture_event("accept_reject_diff", {"accepted": accepted})
        dev_data_logger.capture("accept_reject_diff", {"accepted": accepted})

    def onFileSystemUpdate(self, update: FileSystemEdit):
        # Access to Autopilot (so SessionManager)
        pass

    def onFileEdits(self, edits: List[FileEditWithFullContents]):
        pass

    def onHighlightedCodeUpdate(
        self,
        range_in_files: List[RangeInFileWithContents],
        edit: Optional[bool] = False,
    ):
        for callback in self._highlighted_code_callbacks:
            self.call_callback(callback, range_in_files, edit)

    ## Subscriptions ##

    _highlighted_code_callbacks = []
    _files_created_callbacks = []
    _files_deleted_callbacks = []
    _files_renamed_callbacks = []
    _file_saved_callbacks = []
    _debug_terminal_callbacks = []
    _telemetry_enabled_callbacks = []

    def call_callback(self, callback, *args, **kwargs):
        if asyncio.iscoroutinefunction(callback):
            create_async_task(callback(*args, **kwargs), self.on_error)
        else:
            callback(*args, **kwargs)

    def subscribeToTelemetryEnabled(self, callback: Callable[[bool], Any]):
        self._telemetry_enabled_callbacks.append(callback)

    def subscribeToDebugTerminal(self, callback: Callable[[str], Any]):
        self._debug_terminal_callbacks.append(callback)

    def subscribeToHighlightedCode(
        self, callback: Callable[[List[RangeInFileWithContents], bool], Any]
    ):
        self._highlighted_code_callbacks.append(callback)

    def subscribeToFilesCreated(self, callback: Callable[[List[str]], Any]):
        self._files_created_callbacks.append(callback)

    def subscribeToFilesDeleted(self, callback: Callable[[List[str]], Any]):
        self._files_deleted_callbacks.append(callback)

    def subscribeToFilesRenamed(self, callback: Callable[[List[str], List[str]], Any]):
        self._files_renamed_callbacks.append(callback)

    def subscribeToFileSaved(self, callback: Callable[[str, str], Any]):
        self._file_saved_callbacks.append(callback)

    def onTelemetryEnabledChanged(self, enabled: bool):
        for callback in self._telemetry_enabled_callbacks:
            self.call_callback(callback, enabled)

    def onDebugTerminal(self, content: str):
        for callback in self._debug_terminal_callbacks:
            self.call_callback(callback, content)

    def onFilesCreated(self, filepaths: List[str]):
        for callback in self._files_created_callbacks:
            self.call_callback(callback, filepaths)

    def onFilesDeleted(self, filepaths: List[str]):
        for callback in self._files_deleted_callbacks:
            self.call_callback(callback, filepaths)

    def onFilesRenamed(self, old_filepaths: List[str], new_filepaths: List[str]):
        for callback in self._files_renamed_callbacks:
            self.call_callback(callback, old_filepaths, new_filepaths)

    def onFileSaved(self, filepath: str, contents: str):
        for callback in self._file_saved_callbacks:
            self.call_callback(callback, filepath, contents)

    ## END Subscriptions ##

    # Request information. Session doesn't matter.
    async def getOpenFiles(self) -> List[str]:
        resp = await self.messenger.send_and_receive({}, OpenFilesResponse, "openFiles")
        return resp.openFiles

    async def getVisibleFiles(self) -> List[str]:
        resp = await self.messenger.send_and_receive(
            {}, VisibleFilesResponse, "visibleFiles"
        )
        return resp.visibleFiles

    async def getTerminalContents(self, commands: int = -1) -> str:
        """Get the contents of the terminal, up to the last 'commands' commands, or all if commands is -1"""
        resp = await self.messenger.send_and_receive(
            {"commands": commands}, TerminalContentsResponse, "getTerminalContents"
        )
        return resp.contents.strip()

    async def getHighlightedCode(self) -> List[RangeInFile]:
        resp = await self.messenger.send_and_receive(
            {}, HighlightedCodeResponse, "highlightedCode"
        )
        return resp.highlightedCode

    async def readFile(self, filepath: str) -> str:
        """Read a file"""
        resp = await self.messenger.send_and_receive(
            {"filepath": filepath}, ReadFileResponse, "readFile"
        )
        return resp.contents

    async def fileExists(self, filepath: str) -> bool:
        """Check whether file exists"""
        resp = await self.messenger.send_and_receive(
            {"filepath": filepath}, FileExistsResponse, "fileExists"
        )
        return resp.exists

    async def getUserSecret(self, key: str) -> str:
        """Get a user secret"""
        try:
            resp = await self.messenger.send_and_receive(
                {"key": key}, GetUserSecretResponse, "getUserSecret"
            )
            return resp.value
        except Exception as e:
            logger.debug(f"Error getting user secret: {e}")
            return ""

    async def saveFile(self, filepath: str):
        """Save a file"""
        await self.messenger.send("saveFile", {"filepath": filepath})

    async def readRangeInFile(self, range_in_file: RangeInFile) -> str:
        """Read a range in a file"""
        full_contents = await self.readFile(range_in_file.filepath)
        return FileSystem.read_range_in_str(full_contents, range_in_file.range)

    async def editFile(self, edit: FileEdit) -> FileEditWithFullContents:
        """Edit a file"""
        resp = await self.messenger.send_and_receive(
            {"edit": edit.dict()}, EditFileResponse, "editFile"
        )
        return resp.fileEdit

    async def listDirectoryContents(
        self, directory: str, recursive: bool = False
    ) -> List[str]:
        """List the contents of a directory"""
        resp = await self.messenger.send_and_receive(
            {"directory": directory, "recursive": recursive},
            ListDirectoryContentsResponse,
            "listDirectoryContents",
        )
        return resp.contents

    async def applyFileSystemEdit(self, edit: FileSystemEdit) -> EditDiff:
        """Apply a file edit"""
        backward = None
        fs = RealFileSystem()
        if isinstance(edit, FileEdit):
            file_edit = await self.editFile(edit)
            _, diff = FileSystem.apply_edit_to_str(
                file_edit.fileContents, file_edit.fileEdit
            )
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
            backward = RenameFile(
                filepath=edit.new_filepath, new_filepath=edit.filepath
            )
        elif isinstance(edit, AddDirectory):
            fs.add_directory(edit.path)
            backward = DeleteDirectory(path=edit.path)
        elif isinstance(edit, DeleteDirectory):
            # This isn't atomic!
            backward_edits = []
            for root, dirs, files in os.walk(edit.path, topdown=False):
                for f in files:
                    path = os.path.join(root, f)
                    edit_diff = await self.applyFileSystemEdit(
                        DeleteFile(filepath=path)
                    )
                    backward_edits.append(edit_diff)
                for d in dirs:
                    path = os.path.join(root, d)
                    edit_diff = await self.applyFileSystemEdit(
                        DeleteDirectory(path=path)
                    )
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

        return EditDiff(forward=edit, backward=backward)

    # region Language Server Protocol
    async def goto_definition(self, filepath: str, position: Position):
        return await self.messenger.send_and_receive(
            {"filepath": filepath, "position": position.dict()},
            GotoDefinitionResponse,
            "textDocument/definition",
        )

    async def document_symbol(self, filepath: str):
        return await self.messenger.send_and_receive(
            {"uri": filepath},
            DocumentSymbolResponse,
            "textDocument/documentSymbol",
        )

    async def find_references(
        self, filepath: str, position: Position, include_declaration: bool = False
    ):
        return await self.messenger.send_and_receive(
            {
                "filepath": filepath,
                "position": position.dict(),
                "context": {"includeDeclaration": include_declaration},
            },
            ReferencesResponse,
            "textDocument/references",
        )

    async def folding_range(self, filepath: str):
        return await self.messenger.send_and_receive(
            {"filepath": filepath},
            FoldingRangeResponse,
            "textDocument/foldingRange",
        )

    async def get_enclosing_folding_range(self, rif: RangeInFile):
        ranges = await self.folding_range(rif.filepath)

        max_start_position = Position(line=0, character=0)
        max_range = None
        for r in ranges.ranges:
            range = Range(**r)
            if range.contains(rif.range.start):
                if range.start > max_start_position:
                    max_start_position = range.start
                    max_range = r

        return max_range

    # endregion
