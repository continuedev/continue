import json
import os
import time
from typing import Optional

from ...core.main import Step, StepDescription, SessionState
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getGlobalFolderPath, getSessionFilePath


class ShareSessionStep(Step):
    async def run(self, sdk: ContinueSDK):
        # Format SessionState as a .md file
        import datetime

        # TODO: Can this still be done? Is a slash command really what you want?

        # date_created = datetime.datetime.fromtimestamp(
        #     float(session_state.session_info.date_created)
        # ).strftime("%Y-%m-%d %H:%M:%S")
        # content = f"This is a session transcript from [Continue](https://continue.dev) on {date_created}.\n\n"

        # for node in session_state.history.timeline[:-2]:
        #     if node.step.hide:
        #         continue  # ay

        #     content += f"## {node.step.name}\n"
        #     content += f"{node.step.description}\n\n"

        # # Save to a markdown file
        # save_filepath = os.path.join(
        #     getGlobalFolderPath(), f"{session_state.session_info.title}.md"
        # )

        # with open(save_filepath, "w") as f:
        #     f.write(content)

        # # Open the file
        # await sdk.ide.setFileOpen(save_filepath)

        # self.description = f"The session transcript has been saved to a markdown file at {save_filepath}."
