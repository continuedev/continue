from ...core.main import SessionUpdate


class CommandLineGUI:
    async def send_session_update(self, session_update: SessionUpdate):
        if hasattr(session_update.update, "description"):
            print(session_update.update.description)

    async def send_indexing_progress(self, progress: float):
        print(f"Indexing... {int(progress*100)}%")
