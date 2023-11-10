import requests
import json
from bs4 import BeautifulSoup

from ...libs.llm.base import CompletionOptions
from .chat import SimpleChatStep
from ...core.main import Step
from ...core.sdk import ContinueSDK
from dotenv import load_dotenv
import os

load_dotenv()
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

PROMPT = """
{sources}

Use the above sources to answer this question. Provide links to the sources in markdown whenever possible:

{user_input}
"""


async def get_results(q: str):
    url = "https://google.serper.dev/search"

    payload = json.dumps({"q": q})
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
    }

    response = requests.request("POST", url, headers=headers, data=payload)

    return response.json()


async def get_link_contents(url: str):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    return soup.get_text()


class WebSearchChatStep(Step):
    user_input: str
    name: str = "Chat using Web Search for reference"

    async def run(self, sdk: ContinueSDK):
        model = sdk.models.chat.model
        # if model == "gpt-4":
        #     model = "gpt-4-32k"  # Not publicly available yet?
        if model == "gpt-3.5-turbo":
            model = "gpt-3.5-turbo-16k"

        sources = []
        results = await get_results(self.user_input)
        for result in results:
            contents = await get_link_contents(result["link"])
            sources.append(f"{result['title']}\n\n{contents}\n\n---\n\n")

        await sdk.run_step(
            SimpleChatStep(
                name="Answer Question",
                completion_options=CompletionOptions(model=model),
                prompt=PROMPT.format(user_input=self.user_input, sources=sources),
            )
        )
