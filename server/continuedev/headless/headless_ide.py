import os
import subprocess
import uuid
from typing import Any, Callable, List, NoReturn, Optional

from dotenv import load_dotenv
from fastapi import WebSocket

from continuedev.models.filesystem import (
    FileSystem,
    RangeInFile,
    RangeInFileWithContents,
    RealFileSystem,
)
from continuedev.models.filesystem_edit import EditDiff, FileEdit, FileSystemEdit
from continuedev.models.main import Position
from continuedev.server.protocols.ide_protocol import AbstractIdeProtocolServer

load_dotenv()


def get_mac_address():
    mac_num = hex(uuid.getnode()).replace("0x", "").upper()
    return "-".join(mac_num[i : i + 2] for i in range(0, 11, 2))


class LocalIdeProtocol(AbstractIdeProtocolServer):
    websocket: WebSocket
    session_id: Optional[str]
    workspace_directory: str = os.getcwd()
    unique_id: str = get_mac_address()

    filesystem: FileSystem = RealFileSystem()

    def __init__(self, workspace_directory: Optional[str] = None) -> None:
        if workspace_directory:
            self.workspace_directory = workspace_directory

    async def handle_json(self, data: Any) -> None:
        """Handle a json message."""

    def showSuggestion(self, file_edit: FileEdit) -> None:
        """Show a suggestion to the user."""

    async def setFileOpen(self, filepath: str, open: bool = True) -> None:
        """Set whether a file is open."""

    async def showMessage(self, message: str) -> None:
        """Show a message to the user."""

    async def showVirtualFile(self, name: str, contents: str) -> None:
        """Show a virtual file."""

    async def setSuggestionsLocked(self, filepath: str, locked: bool = True) -> None:
        """Set whether suggestions are locked."""

    async def getSessionId(self) -> None:
        """Get a new session ID."""

    def onAcceptRejectSuggestion(self, accepted: bool) -> None:
        """Called when the user accepts or rejects a suggestion."""

    def onFileSystemUpdate(self, update: FileSystemEdit) -> None:
        """Called when a file system update is received."""

    def onCloseGUI(self, session_id: str) -> None:
        """Called when a GUI is closed."""

    def onOpenGUIRequest(self) -> None:
        """Called when a GUI is requested to be opened."""

    async def getOpenFiles(self) -> List[str]:
        """Get a list of open files."""
        return []

    async def getVisibleFiles(self) -> List[str]:
        """Get a list of visible files."""
        return []

    async def getHighlightedCode(self) -> List[RangeInFile]:
        """Get a list of highlighted code."""
        return []

    async def readFile(self, filepath: str) -> str:
        """Read a file."""
        try:
            return self.filesystem.read(filepath)
        except UnicodeDecodeError:
            return ""

    async def readRangeInFile(self, range_in_file: RangeInFile) -> str:
        """Read a range in a file."""
        return self.filesystem.read_range_in_file(range_in_file)

    async def editFile(self, edit: FileEdit) -> None:
        """Edit a file."""
        self.filesystem.apply_file_edit(edit)

    async def applyFileSystemEdit(self, edit: FileSystemEdit) -> EditDiff:
        """Apply a file edit."""
        return self.filesystem.apply_edit(edit)

    async def saveFile(self, filepath: str) -> None:
        """Save a file."""

    async def getUserSecret(self, key: str):
        """Get a user secret."""
        return os.environ.get(key)

    async def highlightCode(self, range_in_file: RangeInFile, color: str) -> None:
        """Highlight code."""

    async def runCommand(self, command: str) -> str:
        """Run a command using subprocess (don't pass, actually implement)."""
        return subprocess.check_output(command, shell=True).decode("utf-8")

    def onHighlightedCodeUpdate(self, range_in_files: List[RangeInFileWithContents]) -> None:
        """Called when highlighted code is updated."""

    def onDeleteAtIndex(self, index: int) -> None:
        """Called when a step is deleted at a given index."""

    async def showDiff(self, filepath: str, replacement: str, step_index: int) -> None:
        """Show a diff."""

    def subscribeToFilesCreated(self, callback: Callable[[List[str]], None]) -> None:
        """Subscribe to files created event."""

    def subscribeToFilesDeleted(self, callback: Callable[[List[str]], None]) -> None:
        """Subscribe to files deleted event."""

    def subscribeToFilesRenamed(self, callback: Callable[[List[str], List[str]], None]) -> None:
        """Subscribe to files renamed event."""

    def subscribeToFileSaved(self, callback: Callable[[str, str], None]) -> None:
        """Subscribe to file saved event."""

    def onFilesCreated(self, filepaths: List[str]) -> None:
        """Called when files are created."""

    def onFilesDeleted(self, filepaths: List[str]) -> None:
        """Called when files are deleted."""

    def onFilesRenamed(self, old_filepaths: List[str], new_filepaths: List[str]) -> None:
        """Called when files are renamed."""

    def onFileSaved(self, filepath: str, contents: str) -> None:
        """Called when a file is saved."""

    async def fileExists(self, filepath: str) -> bool:
        """Check if a file exists."""
        return self.filesystem.exists(filepath)

    async def getTerminalContents(self) -> str:
        return ""

    async def listDirectoryContents(
        self, directory: str, recursive: bool = False,
    ) -> List[str]:
        return self.filesystem.list_directory_contents(directory, recursive=recursive)

    async def goto_definition(self, filepath: str, position: Position) -> NoReturn:
        raise NotImplementedError

    async def document_symbol(self, filepath: str) -> NoReturn:
        raise NotImplementedError

    async def find_references(
        self, filepath: str, position: Position, include_declaration: bool = False,
    ) -> NoReturn:
        raise NotImplementedError

    async def folding_range(self, filepath: str) -> NoReturn:
        raise NotImplementedError

    async def get_enclosing_folding_range(self, position: Position, filepath: str) -> NoReturn:
        raise NotImplementedError
