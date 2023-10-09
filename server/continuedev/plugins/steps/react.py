from textwrap import dedent
from typing import List, Tuple, Union

from ...core.main import Step
from ...core.sdk import ContinueSDK


class NLDecisionStep(Step):
    user_input: str
    default_step: Union[Step, None] = None
    steps: List[Tuple[Step, str]]

    hide: bool = False
    name: str = "Deciding what to do next"

    async def run(self, sdk: ContinueSDK):
        step_descriptions = "\n".join(
            [f"- {step[0].name}: {step[1]}" for step in self.steps]
        )
        prompt = dedent(
            f"""\
            The following steps are available, in the format "- [step name]: [step description]":
            {step_descriptions}
            
            The user gave the following input:
            
            {self.user_input}
            
            Select the step which should be taken next to satisfy the user input. Say only the name of the selected step. You must choose one:"""
        )

        resp = (await sdk.models.summarize.complete(prompt)).lower()

        step_to_run = None
        for step in self.steps:
            if step[0].name.lower() in resp:
                step_to_run = step[0]

        step_to_run = step_to_run or self.default_step or self.steps[0]

        self.hide = True
        await sdk.update_ui()

        await sdk.run_step(step_to_run)
