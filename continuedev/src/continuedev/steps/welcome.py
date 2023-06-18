from textwrap import dedent
from ..models.filesystem_edit import AddFile
from ..core.main import Step
from ..core.sdk import ContinueSDK, Models
import os


class WelcomeStep(Step):
    name: str = "Welcome to Continue!"
    hide: bool = True

    async def describe(self, models: Models):
        return "Welcome to Continue!"

    async def run(self, sdk: ContinueSDK):
        continue_dir = os.path.expanduser("~/.continue")
        filepath = os.path.join(continue_dir, "calculator.py")
        if os.path.exists(filepath):
            return
        if not os.path.exists(continue_dir):
            os.mkdir(continue_dir)

        await sdk.ide.applyFileSystemEdit(AddFile(filepath=filepath, content=dedent("""\
            \"\"\"
            Welcome to Continue! To learn how to use it, delete this comment and try to use Continue for the following:
            - "Write me a calculator class"
            - Ask for a new method (e.g. "exp", "mod", "sqrt")
            - Type /comment to write comments for the entire class
            - Ask about how the class works, how to write it in another language, etc.
            \"\"\"""")))
