from typing import Dict, Optional
from .ide_protocol import AbstractIdeProtocolServer
from .gui_protocol import AbstractGUIProtocolServer


class Window:
    # Do you want to have stubs for each? So that if it isn't there yet the functions aren't broken?
    # Or force users to check?
    ide: Optional[AbstractIdeProtocolServer] = None
    gui: Optional[AbstractGUIProtocolServer] = None

    def is_closed(self) -> bool:
        return self.ide is None and self.gui is None


class WindowManager:
    windows: Dict[str, Window]

    def get_window(self, window_id: str) -> Window:
        return self.windows[window_id]

    def register_ide(self, window_id: str, ide: AbstractIdeProtocolServer):
        if window_id not in self.windows:
            self.windows[window_id] = Window()

        self.windows[window_id].ide = ide

    def remove_ide(self, window_id: str):
        if window_id in self.windows:
            self.windows[window_id].ide = None
            if self.windows[window_id].is_closed():
                del self.windows[window_id]

    def register_gui(self, window_id: str, gui: AbstractGUIProtocolServer):
        if window_id not in self.windows:
            self.windows[window_id] = Window()

        self.windows[window_id].gui = gui

    def remove_gui(self, window_id: str):
        if window_id in self.windows:
            self.windows[window_id].gui = None
            if self.windows[window_id].is_closed():
                del self.windows[window_id]


window_manager = WindowManager()
