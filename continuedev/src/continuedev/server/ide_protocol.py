from typing import Any, List, Union
from abc import ABC, abstractmethod, abstractproperty
from fastapi import WebSocket

from ..models.main import Traceback
from ..models.filesystem_edit import FileEdit, FileSystemEdit, EditDiff
from ..models.filesystem import RangeInFile, RangeInFileWithContents


class AbstractIdeProtocolServer(ABC):
    websocket: WebSocket
    session_id: Union[str, None]

    @abstractmethod
    async def handle_json(self, data: Any):
        """Handle a json message"""

    @abstractmethod
    def showSuggestion(self, file_edit: FileEdit):
        """Show a suggestion to the user"""

    @abstractmethod
    async def setFileOpen(self, filepath: str, open: bool = True):
        """Set whether a file is open"""

    @abstractmethod
    async def setSuggestionsLocked(self, filepath: str, locked: bool = True):
        """Set whether suggestions are locked"""

    @abstractmethod
    async def getSessionId(self):
        """Get a new session ID"""

    @abstractmethod
    async def showSuggestionsAndWait(self, suggestions: List[FileEdit]) -> bool:
        """Show suggestions to the user and wait for a response"""

    @abstractmethod
    def onAcceptRejectSuggestion(self, accepted: bool):
        """Called when the user accepts or rejects a suggestion"""

    @abstractmethod
    def onFileSystemUpdate(self, update: FileSystemEdit):
        """Called when a file system update is received"""

    @abstractmethod
    def onCloseGUI(self, session_id: str):
        """Called when a GUI is closed"""

    @abstractmethod
    def onOpenGUIRequest(self):
        """Called when a GUI is requested to be opened"""

    @abstractmethod
    async def getOpenFiles(self) -> List[str]:
        """Get a list of open files"""

    @abstractmethod
    async def getVisibleFiles(self) -> List[str]:
        """Get a list of visible files"""

    @abstractmethod
    async def getHighlightedCode(self) -> List[RangeInFile]:
        """Get a list of highlighted code"""

    @abstractmethod
    async def readFile(self, filepath: str) -> str:
        """Read a file"""

    @abstractmethod
    async def readRangeInFile(self, range_in_file: RangeInFile) -> str:
        """Read a range in a file"""

    @abstractmethod
    async def editFile(self, edit: FileEdit):
        """Edit a file"""

    @abstractmethod
    async def applyFileSystemEdit(self, edit: FileSystemEdit) -> EditDiff:
        """Apply a file edit"""

    @abstractmethod
    async def saveFile(self, filepath: str):
        """Save a file"""

    @abstractmethod
    async def getUserSecret(self, key: str):
        """Get a user secret"""

    @abstractmethod
    async def highlightCode(self, range_in_file: RangeInFile, color: str):
        """Highlight code"""

    @abstractmethod
    async def runCommand(self, command: str) -> str:
        """Run a command"""

    @abstractmethod
    def onHighlightedCodeUpdate(self, range_in_files: List[RangeInFileWithContents]):
        """Called when highlighted code is updated"""

    @abstractmethod
    def onDeleteAtIndex(self, index: int):
        """Called when a step is deleted at a given index"""

    @abstractmethod
    async def showDiff(self, filepath: str, replacement: str, step_index: int):
        """Show a diff"""

    workspace_directory: str

    @abstractproperty
    def unique_id(self) -> str:
        """Get a unique ID for this IDE"""
