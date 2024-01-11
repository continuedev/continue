import os
import subprocess
import uuid
from typing import Any, Callable, List, Optional

from dotenv import load_dotenv
from fastapi import WebSocket

from ..models.filesystem import (
    FileSystem,
    RangeInFile,
    RangeInFileWithContents,
    RealFileSystem,
)
from ..models.filesystem_edit import EditDiff, FileEdit, FileSystemEdit
from ..models.main import Position
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer

load_dotenv()


def get_mac_address():
    mac_num = hex(uuid.getnode()).replace("0x", "").upper()
    mac = "-".join(mac_num[i : i + 2] for i in range(0, 11, 2))
    return mac


class LocalIdeProtocol(AbstractIdeProtocolServer):
    websocket: WebSocket
    session_id: Optional[str]
    workspace_directory: str = os.getcwd()
    unique_id: str = get_mac_address()

    filesystem: FileSystem = RealFileSystem()

    def __init__(self, workspace_directory: Optional[str] = None):
        if workspace_directory:
            self.workspace_directory = workspace_directory

    async def handle_json(self, data: Any):
        """Handle a json message"""
        pass

    def showSuggestion(self, file_edit: FileEdit):
        """Show a suggestion to the user"""
        pass

    async def setFileOpen(self, filepath: str, open: bool = True):
        """Set whether a file is open"""
        pass

    async def showMessage(self, message: str):
        """Show a message to the user"""
        print(message)

    async def showVirtualFile(self, name: str, contents: str):
        """Show a virtual file"""
        pass

    async def setSuggestionsLocked(self, filepath: str, locked: bool = True):
        """Set whether suggestions are locked"""
        pass

    async def getSessionId(self):
        """Get a new session ID"""
        pass

    def onAcceptRejectSuggestion(self, accepted: bool):
        """Called when the user accepts or rejects a suggestion"""
        pass

    def onFileSystemUpdate(self, update: FileSystemEdit):
        """Called when a file system update is received"""
        pass

    def onCloseGUI(self, session_id: str):
        """Called when a GUI is closed"""
        pass

    def onOpenGUIRequest(self):
        """Called when a GUI is requested to be opened"""
        pass

    async def getOpenFiles(self) -> List[str]:
        """Get a list of open files"""
        return []

    async def getVisibleFiles(self) -> List[str]:
        """Get a list of visible files"""
        return []

    async def getHighlightedCode(self) -> List[RangeInFile]:
        """Get a list of highlighted code"""
        return []

    async def readFile(self, filepath: str) -> str:
        """Read a file"""
        try:
            return self.filesystem.read(filepath)
        except UnicodeDecodeError:
            return ""

    async def readRangeInFile(self, range_in_file: RangeInFile) -> str:
        """Read a range in a file"""
        return self.filesystem.read_range_in_file(range_in_file)

    async def editFile(self, edit: FileEdit):
        """Edit a file"""
        self.filesystem.apply_file_edit(edit)

    async def applyFileSystemEdit(self, edit: FileSystemEdit) -> EditDiff:
        """Apply a file edit"""
        return self.filesystem.apply_edit(edit)

    async def saveFile(self, filepath: str):
        """Save a file"""
        pass

    async def getUserSecret(self, key: str):
        """Get a user secret"""
        return os.environ.get(key)

    async def highlightCode(self, range_in_file: RangeInFile, color: str):
        """Highlight code"""
        pass

    async def runCommand(self, command: str) -> str:
        """Run a command using subprocess (don't pass, actually implement)"""
        return subprocess.check_output(command, shell=True).decode("utf-8")

    def onHighlightedCodeUpdate(self, range_in_files: List[RangeInFileWithContents]):
        """Called when highlighted code is updated"""
        pass

    def onDeleteAtIndex(self, index: int):
        """Called when a step is deleted at a given index"""
        pass

    async def showDiff(self, filepath: str, replacement: str, step_index: int):
        """Show a diff"""
        pass

    def subscribeToFilesCreated(self, callback: Callable[[List[str]], None]):
        """Subscribe to files created event"""
        pass

    def subscribeToFilesDeleted(self, callback: Callable[[List[str]], None]):
        """Subscribe to files deleted event"""
        pass

    def subscribeToFilesRenamed(self, callback: Callable[[List[str], List[str]], None]):
        """Subscribe to files renamed event"""
        pass

    def subscribeToFileSaved(self, callback: Callable[[str, str], None]):
        """Subscribe to file saved event"""
        pass

    def onFilesCreated(self, filepaths: List[str]):
        """Called when files are created"""
        pass

    def onFilesDeleted(self, filepaths: List[str]):
        """Called when files are deleted"""
        pass

    def onFilesRenamed(self, old_filepaths: List[str], new_filepaths: List[str]):
        """Called when files are renamed"""
        pass

    def onFileSaved(self, filepath: str, contents: str):
        """Called when a file is saved"""
        pass

    async def fileExists(self, filepath: str) -> bool:
        """Check if a file exists"""
        return self.filesystem.exists(filepath)

    async def getTerminalContents(self) -> str:
        return ""

    async def listDirectoryContents(
        self, directory: str, recursive: bool = False
    ) -> List[str]:
        return self.filesystem.list_directory_contents(directory, recursive=recursive)

    async def goto_definition(self, filepath: str, position: Position):
        raise NotImplementedError()

    async def document_symbol(self, filepath: str):
        raise NotImplementedError()

    async def find_references(
        self, filepath: str, position: Position, include_declaration: bool = False
    ):
        raise NotImplementedError()

    async def folding_range(self, filepath: str):
        raise NotImplementedError()

    async def get_enclosing_folding_range(self, position: Position, filepath: str):
        raise NotImplementedError()
