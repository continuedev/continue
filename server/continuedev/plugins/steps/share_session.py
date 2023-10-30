import os

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getGlobalFolderPath


class ShareSessionStep(Step):
    async def run(self, sdk: ContinueSDK):
        # Format SessionState as a .md file
        import datetime

        date_created = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        content = f"This is a session transcript from [Continue](https://continue.dev) on {date_created}.\n\n"

        for step in sdk.history[:-2]:
            if step.hide:
                continue  # ay

            content += f"## {step.name}\n"
            content += f"{step.description}\n\n"

        # Save to a markdown file
        save_filepath = os.path.join(
            getGlobalFolderPath(), f"continue ({date_created}).md"
        )

        with open(save_filepath, "w") as f:
            f.write(content)

        # Open the file
        await sdk.ide.setFileOpen(save_filepath)

        self.description = f"The session transcript has been saved to a markdown file at {save_filepath}."
