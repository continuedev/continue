from textwrap import dedent
from typing import List, Union
from ..core.main import Step
from ..core.sdk import ContinueSDK
from .core.core import MessageStep


class NLDecisionStep(Step):
    user_input: str
    steps: List[Step]
    hide: bool = True
    default_step: Union[Step, None] = None

    async def run(self, sdk: ContinueSDK):
        step_descriptions = "\n".join([
            f"- {step.name}: {step.description}"
            for step in self.steps
        ])
        prompt = dedent(f"""\
                        The following steps are available, in the format "- [step name]: [step description]":
                        {step_descriptions}
                        
                        The user gave the following input:
                        
                        {self.user_input}
                        
                        Select the step which should be taken next. Say only the name of the selected step:""")

        resp = sdk.models.gpt35.complete(prompt).lower()

        step_to_run = None
        for step in self.steps:
            if step.name.lower() in resp:
                step_to_run = step

        step_to_run = step_to_run or self.default_step or self.steps[0]

        await sdk.run_step(step_to_run)
