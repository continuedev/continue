import json
import os
import time
from typing import Optional

from ...core.main import FullState, Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getGlobalFolderPath, getSessionFilePath
from ...server.session_manager import session_manager


class ShareSessionStep(Step):
    session_id: Optional[str] = None

    async def run(self, sdk: ContinueSDK):
        if self.session_id is None:
            self.session_id = sdk.ide.session_id

        await session_manager.persist_session(self.session_id)
        time.sleep(0.5)

        # Load the session data and format as a markdown file
        session_filepath = getSessionFilePath(self.session_id)
        with open(session_filepath, "r") as f:
            session_state = FullState(**json.load(f))

        import datetime

        date_created = datetime.datetime.fromtimestamp(
            float(session_state.session_info.date_created)
        ).strftime("%Y-%m-%d %H:%M:%S")
        content = f"This is a session transcript from [Continue](https://continue.dev) on {date_created}.\n\n"

        for node in session_state.history.timeline[:-2]:
            if node.step.hide:
                continue  # ay

            content += f"## {node.step.name}\n"
            content += f"{node.step.description}\n\n"

        # Save to a markdown file
        save_filepath = os.path.join(
            getGlobalFolderPath(), f"{session_state.session_info.title}.md"
        )

        with open(save_filepath, "w") as f:
            f.write(content)

        # Open the file
        await sdk.ide.setFileOpen(save_filepath)

        self.description = f"The session transcript has been saved to a markdown file at {save_filepath}."
