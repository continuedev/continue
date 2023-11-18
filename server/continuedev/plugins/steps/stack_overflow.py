import json
from typing import Optional

import html2text
import requests
from bs4 import BeautifulSoup

from ...core.main import ContextItem, ContextItemDescription, ContextItemId, Step
from ...core.sdk import ContinueSDK
from ...libs.llm.base import CompletionOptions
from ...libs.util.count_tokens import prune_string_from_bottom
from ...libs.util.logging import logger
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep

# SERVER_URL = "http://127.0.0.1:8080"
SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app"
PROMPT = """The above sources are excerpts from related StackOverflow questions. Use them to help answer the below question from our user. Provide links to the sources in markdown whenever possible:

{user_input}
"""


async def get_results(q: str):
    payload = json.dumps({"q": f"{q} site:stackoverflow.com"})

    try:
        response = requests.request("POST", f"{SERVER_URL}/search", data=payload)
        return response.json()
    except Exception:
        logger.warning(
            "You have been rate limited. Try the search endpoint again in a few minutes."
        )
        return {"organic": []}


async def get_link_contents(url: str) -> Optional[str]:
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    converter = html2text.HTML2Text()

    h1 = soup.find("h1", {"class": "fs-headline1"})
    title = h1.text.strip() if h1 else "No Title"
    bodies = soup.find_all("div", {"class": "js-post-body"})
    if len(bodies) < 2:
        return None

    question = converter.handle(str(bodies[0]))
    answer = converter.handle(str(bodies[1]))

    content = f"""\
# Question: [{title}]({url})

{question}

# Best Answer

{answer}
"""
    return content


class StackOverflowStep(Step):
    user_input: str
    name: str = "Chat using StackOverflow for reference"
    max_sources: int = 3
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        model = sdk.models.chat.model

        context_length = sdk.models.chat.context_length

        sources = []
        results = await get_results(self.user_input)
        links = [result["link"] for result in results["organic"]]

        total_tokens = sdk.models.chat.count_tokens(self.user_input) + 200
        for link in links:
            if contents := await get_link_contents(link):
                sources.append(contents)
                new_tokens = sdk.models.chat.count_tokens(contents)
                total_tokens += new_tokens

                should_break = False
                if total_tokens >= context_length:
                    # Prune the last source line-by-line from the bottom
                    sources[-1] = prune_string_from_bottom(
                        sdk.models.chat.model,
                        context_length - (total_tokens - new_tokens),
                        sources[-1],
                    )
                    should_break = True

                if len(sources) >= self.max_sources:
                    should_break = True

                await sdk.add_context_item(
                    ContextItem(
                        content=sources[-1],
                        description=ContextItemDescription(
                            name=f"StackOverflow #{len(sources)}",
                            description="StackOverflow Answer",
                            id=ContextItemId(
                                provider_title="",
                                item_id=remove_meilisearch_disallowed_chars(
                                    links[len(sources) - 1]
                                ),
                            ),
                        ),
                    )
                )

                if should_break:
                    break

        await sdk.run_step(
            SimpleChatStep(
                name="Answer Question",
                completion_options=CompletionOptions(model=model),
                prompt=PROMPT.format(user_input=self.user_input),
            )
        )
