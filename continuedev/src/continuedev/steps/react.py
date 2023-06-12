from textwrap import dedent
<<<<<<< Updated upstream
from typing import List, Union
=======
from typing import List, Tuple
>>>>>>> Stashed changes
from ..core.main import Step
from ..core.sdk import ContinueSDK
from .core.core import MessageStep


class NLDecisionStep(Step):
    user_input: str
<<<<<<< Updated upstream
    steps: List[Step]
    hide: bool = True
    default_step: Union[Step, None] = None
=======
    steps: List[Tuple[Step, str]]

    hide: bool = True
>>>>>>> Stashed changes

    async def run(self, sdk: ContinueSDK):
        step_descriptions = "\n".join([
            f"- {step[0].name}: {step[1]}"
            for step in self.steps
        ])
        prompt = dedent(f"""\
            The following steps are available, in the format "- [step name]: [step description]":
            {step_descriptions}
            
            The user gave the following input:
            
            {self.user_input}
            
            Select the step which should be taken next to satisfy the user input. Say only the name of the selected step. You must choose one:""")

        resp = sdk.models.gpt35.complete(prompt).lower()

        step_to_run = None
        for step in self.steps:
<<<<<<< Updated upstream
            if step.name.lower() in resp:
                step_to_run = step
=======
            if step[0].name.lower() in resp:
                step_to_run = step[0]
>>>>>>> Stashed changes

        step_to_run = step_to_run or self.default_step or self.steps[0]

        await sdk.run_step(step_to_run)
