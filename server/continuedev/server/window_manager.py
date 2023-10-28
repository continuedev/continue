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
    windows: Dict[str, Window] = {}

    def get_window(self, sid: str) -> Window:
        return self.windows[sid]

    def register_ide(self, sid: str, ide: AbstractIdeProtocolServer):
        if sid not in self.windows:
            self.windows[sid] = Window()

        self.windows[sid].ide = ide

    def remove_ide(self, sid: str):
        if sid in self.windows:
            self.windows[sid].ide = None
            if self.windows[sid].is_closed():
                del self.windows[sid]

    def register_gui(self, sid: str, gui: AbstractGUIProtocolServer):
        if sid not in self.windows:
            self.windows[sid] = Window()

        self.windows[sid].gui = gui

    def remove_gui(self, sid: str):
        if sid in self.windows:
            self.windows[sid].gui = None
            if self.windows[sid].is_closed():
                del self.windows[sid]


window_manager = WindowManager()
