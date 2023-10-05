from typing import List, Union

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ..core.core import WaitForUserInputStep


class NLMultiselectStep(Step):
    hide: bool = True

    prompt: str
    options: List[str]

    async def run(self, sdk: ContinueSDK):
        user_response = (
            await sdk.run_step(WaitForUserInputStep(prompt=self.prompt))
        ).text

        def extract_option(text: str) -> Union[str, None]:
            for option in self.options:
                if option in text:
                    return option
            return None

        first_try = extract_option(user_response.lower())
        if first_try is not None:
            return first_try

        gpt_parsed = await sdk.models.default.complete(
            f"These are the available options are: [{', '.join(self.options)}]. The user requested {user_response}. This is the exact string from the options array that they selected:"
        )
        return extract_option(gpt_parsed) or self.options[0]
