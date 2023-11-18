# An agent that makes a full commit in the background
# Plans
# Write code
# Reviews code
# Cleans up

# It's important that agents are configurable, because people need to be able to specify
# which hooks they want to run. Specific linter, run tests, etc.
# And all of this can be easily specified in the Policy.


from textwrap import dedent
from typing import Literal, Optional

from ...core.config import ContinueConfig
from ...core.main import Policy, SessionState, Step
from ...core.observation import TextObservation
from ...core.sdk import ContinueSDK


class PlanStep(Step):
    user_input: str

    _prompt = dedent(
        """\
        You were given the following instructions: "{user_input}".
            
        Create a plan for how you will complete the task.
            
        Here are relevant files:

        {relevant_files}
            
        Your plan will include:
        1. A high-level description of how you are going to accomplish the task
        2. A list of which files you will edit
        3. A description of what you will change in each file
        """
    )

    async def run(self, sdk: ContinueSDK):
        plan = await sdk.models.default.complete(
            self._prompt.format(
                {"user_input": self.user_input, "relevant_files": "TODO"}
            )
        )
        return TextObservation(text=plan)


class WriteCommitStep(Step):
    async def run(self, sdk: ContinueSDK):
        pass


class ReviewCodeStep(Step):
    async def run(self, sdk: ContinueSDK):
        pass


class CleanupStep(Step):
    async def run(self, sdk: ContinueSDK):
        pass


class CommitPolicy(Policy):
    user_input: str

    current_step: Literal["plan", "write", "review", "cleanup"] = "plan"

    def next(
        self, config: ContinueConfig, session_state: SessionState
    ) -> Optional[Step]:
        if len(session_state.history) == 0:
            return (
                PlanStep(user_input=self.user_input)
                >> WriteCommitStep()
                >> ReviewCodeStep()
                >> CleanupStep()
            )
