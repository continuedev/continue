import asyncio
from textwrap import dedent
from urllib.parse import quote

from continuedev.core.main import SetStep

from ...core.main import Step
from ...core.sdk import ContinueSDK


class DraftIssueStep(Step):
    user_input: str
    repository_url: str

    async def run(self, sdk: ContinueSDK):
        yield SetStep(description="Generating title and description...")

        title_task = sdk.models.summarize.complete(
            f"Generate a title for the GitHub issue requested in this user input: '{self.user_input}'. Use no more than 20 words and output nothing other than the title. The title is: ",
            max_tokens=20,
        )
        body_task = sdk.models.summarize.complete(
            dedent(
                f"""\
                You will be asked to generate the body of a GitHub issue given a user request. You should follow these rules:
                - Be descriptive but do not make up details
                - If the the user request includes any code snippets that are relevant, reference them in code blocks
                - Describe step by step how to reproduce the problem
                - Describe the ideal solution to the problem
                - Describe the expected behavior after the issue has been resolved

                Here is the user request: '{self.user_input}'

                Now here is the body of the GitHub issue:\n"""
            )
        )

        title, body = await asyncio.gather(title_task, body_task)
        url = (
            f"{self.repository_url}/issues/new?title={quote(title)}&body={quote(body)}"
        )

        yield SetStep(description=f"[{title}]({url}):\n\n{body}")
