from textwrap import dedent
from typing import Optional
from urllib.parse import quote

from ...core.main import ChatMessage, Step
from ...core.sdk import ContinueSDK
from ...libs.util.strings import remove_quotes_and_escapes


class DraftIssueStep(Step):
    user_input: str
    repository_url: str
    additional_instructions: Optional[str] = None

    async def run(self, sdk: ContinueSDK):
        title = await sdk.models.summarize.complete(
            f"Generate a title for the GitHub issue requested in this user input: '{self.user_input}'. Use no more than 20 words and output nothing other than the title. Do not surround it with quotes. The title is: ",
            max_tokens=20,
        )

        yield remove_quotes_and_escapes(title) + "\n\n"

        additional_instructions = (
            ""
            if self.additional_instructions is None
            else f"\nAlso follow these additional instructions:\n{self.additional_instructions}"
        )

        body = ""
        messages = await sdk.get_context_item_chat_messages() + [
            ChatMessage(
                role="user",
                content=dedent(
                    f"""\
                You will be asked to generate the body of a GitHub issue given a user request. You should follow these rules:
                - Be descriptive but do not make up details
                - If the the user request includes any code snippets that are relevant, reference them in code blocks
                - Describe step by step how to reproduce the problem
                - Describe the ideal solution to the problem
                - Describe the expected behavior after the issue has been resolved
                - This issue will be read by a team member
                - Use markdown formatting, but you do not need to surround the entire body with triple backticks
                {additional_instructions}

                Here is the user request: '{self.user_input}'

                Title: {title}

                Body:\n\n"""
                ),
            )
        ]
        async for chunk in sdk.models.default.stream_chat(messages):
            body += chunk.content
            yield chunk.content

        url = (
            f"{self.repository_url}/issues/new?title={quote(title)}&body={quote(body)}"
        )

        yield f"\n\n[Link to draft of issue]({url})"
